"""
Face Value -- v1 (final)
Scores every FIELD GOAL by difficulty (xPTS), adds a FREE-THROW value term,
ranks players by points scored above expectation, and EXPORTS players.json
for the web UI.

Run on real data (locally, needs internet to stats.nba.com):
    python face_value_v1_final.py --season 2025-26
Run offline to validate the pipeline + get a sample players.json:
    python face_value_v1_final.py --synthetic
Output: players.json  (leaderboard + per-player shots for the charts)
"""

import argparse, json, time, datetime
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split
from sklearn.metrics import log_loss, roc_auc_score, brier_score_loss

NUMERIC = ["SHOT_DISTANCE", "LOC_X", "LOC_Y"]
CATEGORICAL = ["SHOT_ZONE_BASIC", "SHOT_TYPE", "ACTION_BUCKET"]
TEAM_IDS = list(range(1610612737, 1610612767))   # all 30 NBA team ids
BUCKETS = [("vt","0-2 Feet - Very Tight"), ("t","2-4 Feet - Tight"),
           ("o","4-6 Feet - Open"), ("wo","6+ Feet - Wide Open")]  # v2: closest-defender

# ----------------------------------------------------------------------------
# 1. DATA
# ----------------------------------------------------------------------------
def fetch_shots_nba(season):
    """Every field-goal attempt in a season, pulled team-by-team."""
    from nba_api.stats.endpoints import shotchartdetail
    print("Fetching 30 teams team-by-team ...")
    frames = []
    for i, tid in enumerate(TEAM_IDS, 1):
        r = shotchartdetail.ShotChartDetail(
            team_id=tid, player_id=0, season_nullable=season,
            season_type_all_star="Regular Season",
            context_measure_simple="FGA", timeout=60)
        df = r.get_data_frames()[0]
        frames.append(df)
        print(f"  [{i:02d}/30] {len(df):,} shots")
        time.sleep(0.6)                       # be polite to the API
    return pd.concat(frames, ignore_index=True)

def fetch_player_ft_nba(season):
    """Season FT makes/attempts per player (free throws aren't in shot data)."""
    from nba_api.stats.endpoints import leaguedashplayerstats
    r = leaguedashplayerstats.LeagueDashPlayerStats(
        season=season, season_type_all_star="Regular Season",
        per_mode_detailed="Totals", timeout=60)
    df = r.get_data_frames()[0]
    return df[["PLAYER_ID", "PLAYER_NAME", "FGA", "FTM", "FTA"]]

def synthetic_shots(n_players=70, seed=7):
    rng = np.random.default_rng(seed)
    zones = {"Restricted Area":(0.62,2,False,"Layup"),
             "In The Paint (Non-RA)":(0.42,8,False,"Floater"),
             "Mid-Range":(0.40,16,False,"Jump Shot"),
             "Left Corner 3":(0.40,22,True,"Jump Shot"),
             "Right Corner 3":(0.40,22,True,"Jump Shot"),
             "Above the Break 3":(0.355,26,True,"Jump Shot")}
    zn = list(zones); rows = []
    for pid in range(n_players):
        skill = rng.normal(0, 0.35)
        diet = rng.dirichlet(np.ones(len(zn)) * rng.uniform(0.6, 2.0))
        for _ in range(int(rng.integers(250, 900))):
            z = zn[rng.choice(len(zn), p=diet)]
            base, mdist, is3, action = zones[z]
            dist = max(0, rng.normal(mdist, 3))
            p = 1/(1+np.exp(-(np.log(base/(1-base)) + skill - 0.015*(dist-mdist))))
            ang = rng.uniform(-1, 1)
            rows.append({"PLAYER_ID":pid, "PLAYER_NAME":f"Player {pid:02d}",
                "TEAM_NAME":f"T{pid%30:02d}", "SHOT_DISTANCE":round(dist,1),
                "LOC_X":round(dist*10*ang,1), "LOC_Y":round(dist*10,1),
                "SHOT_TYPE":"3PT Field Goal" if is3 else "2PT Field Goal",
                "SHOT_ZONE_BASIC":z, "ACTION_TYPE":action,
                "SHOT_MADE_FLAG":int(rng.random()<p), "_TRUE_SKILL":skill})
    return pd.DataFrame(rows)

def synthetic_ft(shots, seed=7):
    rng = np.random.default_rng(seed+1)
    g = shots.groupby(["PLAYER_ID","PLAYER_NAME"]).size().reset_index(name="FGA")
    g["FTA"] = (g.FGA * rng.uniform(0.1,0.5,len(g))).round()
    g["FTM"] = (g.FTA * np.clip(rng.normal(0.78,0.08,len(g)),0.5,0.95)).round()
    return g

# ----------------------------------------------------------------------------
# 2. FEATURES + MODEL
# ----------------------------------------------------------------------------
def action_bucket(a):
    a = str(a).lower()
    if "dunk" in a: return "dunk"
    if "layup" in a or "tip" in a: return "layup"
    if "hook" in a: return "hook"
    if any(k in a for k in ("fadeaway","pullup","pull-up","step back")): return "tough_jumper"
    if "jump" in a or "float" in a: return "jumper"
    return "other"

def build_features(df):
    df = df.copy()
    df["ACTION_BUCKET"] = df["ACTION_TYPE"].map(action_bucket)
    df["SHOT_VALUE"] = np.where(df["SHOT_TYPE"].str.contains("3"), 3, 2)
    return df, df[NUMERIC+CATEGORICAL], df["SHOT_MADE_FLAG"].astype(int)

def make_model():
    pre = ColumnTransformer([("num", StandardScaler(), NUMERIC),
                             ("cat", OneHotEncoder(handle_unknown="ignore"), CATEGORICAL)])
    return Pipeline([("pre", pre),
                     ("clf", HistGradientBoostingClassifier(max_iter=300, learning_rate=0.07))])

# ----------------------------------------------------------------------------
# 2b. OPENNESS (v2) -- player-level closest-defender adjustment
# ----------------------------------------------------------------------------
def fetch_openness_nba(season):
    """Per-player FGA + points in each closest-defender bucket (player-level totals)."""
    from nba_api.stats.endpoints import leaguedashplayerptshot
    merged = None
    for key, rng in BUCKETS:
        r = leaguedashplayerptshot.LeagueDashPlayerPtShot(
            league_id="00", season=season, season_type_all_star="Regular Season",
            per_mode_simple="Totals",
            close_def_dist_range_nullable=rng, timeout=60)
        d = r.get_data_frames()[0]
        sub = pd.DataFrame({"PLAYER_ID": d["PLAYER_ID"],
                            f"fga_{key}": d["FGA"],
                            f"pts_{key}": 2 * d["FGM"] + d["FG3M"]})
        merged = sub if merged is None else merged.merge(sub, on="PLAYER_ID", how="outer")
        print(f"  openness [{rng}] -> {len(d)} players")
        time.sleep(0.6)
    return merged.fillna(0)

def synthetic_openness(shots, seed=7):
    """Fake defender-distance splits so we can validate the v2 math offline."""
    rng = np.random.default_rng(seed + 2)
    pps_base = {"vt": 0.85, "t": 0.95, "o": 1.05, "wo": 1.18}   # open shots score more
    base_mix = np.array([0.18, 0.30, 0.30, 0.22])
    g = shots.groupby("PLAYER_ID").size().reset_index(name="tot")
    rows = []
    for r in g.itertuples():
        tend = rng.normal(0, 1)                                  # >0 = more contested
        mix = np.clip(base_mix + np.array([tend, tend*0.5, -tend*0.5, -tend]) * 0.06, 0.02, None)
        mix /= mix.sum()
        fga = (mix * r.tot).round()
        row = {"PLAYER_ID": r.PLAYER_ID}
        for (key, _), f in zip(BUCKETS, fga):
            row[f"fga_{key}"] = f
            row[f"pts_{key}"] = round(pps_base[key] * f * (1 + rng.normal(0, 0.04)), 1)
        rows.append(row)
    return pd.DataFrame(rows)

def compute_openness_adjustment(op):
    """How much to nudge each player's grade for taking easier/harder-than-average looks."""
    keys = [k for k, _ in BUCKETS]
    lf = {k: op[f"fga_{k}"].sum() for k in keys}
    lp = {k: op[f"pts_{k}"].sum() for k in keys}
    pps = {k: (lp[k] / lf[k] if lf[k] else 0.0) for k in keys}   # league pts/shot per bucket
    league_open_pps = sum(lp.values()) / max(sum(lf.values()), 1)
    op = op.copy()
    op["fga_total"] = sum(op[f"fga_{k}"] for k in keys)
    tot = op["fga_total"].replace(0, np.nan)
    op["open_pps"] = sum((op[f"fga_{k}"] / tot) * pps[k] for k in keys)   # their mix -> implied pps
    op["contested_share"] = (op["fga_vt"] + op["fga_t"]) / tot
    # more contested than average -> open_pps below league -> POSITIVE credit
    op["openness_adj"] = ((league_open_pps - op["open_pps"]) * 100).fillna(0.0)
    return op[["PLAYER_ID","fga_total","open_pps","contested_share","openness_adj"]], pps, league_open_pps

# ----------------------------------------------------------------------------
# 3. LEADERBOARD (FG model + FT term)  +  verdicts
# ----------------------------------------------------------------------------
def verdict(p):
    if p >= 8:  return ("Elite shot-maker", "good")
    if p >= 3:  return ("Above expected", "good")
    if p > -3:  return ("As expected", "neutral")
    if p > -8:  return ("Below expected", "bad")
    return ("Empty / cold", "bad")

def leaderboard(df, proba, ft, min_att=200, openness=None):
    d = df.copy()
    d["xpts"] = proba * d["SHOT_VALUE"]
    d["pts"]  = d["SHOT_MADE_FLAG"] * d["SHOT_VALUE"]
    d = d[d["SHOT_DISTANCE"] < 35].copy()   # heaves: shown on chart, NOT counted in the grade
    keys = ["PLAYER_ID","PLAYER_NAME"]
    team = (d.groupby(keys)["TEAM_NAME"].agg(lambda s: s.mode().iloc[0])
              if "TEAM_NAME" in d else None)
    agg = d.groupby(keys).agg(shots=("pts","size"), fg_actual=("pts","sum"),
                              fg_expected=("xpts","sum"),
                              true_skill=("_TRUE_SKILL","mean") if "_TRUE_SKILL" in d else ("pts","size"))
    if team is not None: agg["team"] = team
    agg = agg.reset_index()

    league_ft = ft["FTM"].sum() / max(ft["FTA"].sum(), 1)
    agg = agg.merge(ft[["PLAYER_ID","FTM","FTA"]], on="PLAYER_ID", how="left").fillna({"FTM":0,"FTA":0})
    agg["ft_expected"] = agg["FTA"] * league_ft
    agg["ft_diff"]     = agg["FTM"] - agg["ft_expected"]
    agg["fg_diff"]     = agg["fg_actual"] - agg["fg_expected"]
    agg["diff"]        = agg["fg_diff"] + agg["ft_diff"]          # total points above expected
    agg["per100"]      = agg["diff"] / agg["shots"] * 100
    agg["per100_base"] = agg["per100"]                          # before openness (v1 number)
    if openness is not None:
        m = openness.set_index("PLAYER_ID")["openness_adj"]
        agg["openness_adj"] = agg["PLAYER_ID"].map(m).fillna(0.0)
        agg["per100"]       = agg["per100_base"] + agg["openness_adj"]   # v2 number
    else:
        agg["openness_adj"] = 0.0
    agg = agg[agg["shots"] >= min_att].sort_values("per100", ascending=False)
    agg[["label","cat"]] = agg["per100"].apply(lambda p: pd.Series(verdict(p)))
    return agg, league_ft

# ----------------------------------------------------------------------------
# 4. EXPORT players.json  (leaderboard + per-player shots for charts)
# ----------------------------------------------------------------------------
def quality(xp, dist):
    # heaves (half/full-court) are their own bucket -- shown on the chart, but
    # they don't count toward the grade (see leaderboard()).
    if dist >= 35:
        return "heave"
    # otherwise bucket by EXPECTED POINTS (xPTS = make% x value), NOT make% alone.
    # an open 3 (~1.15 xPTS) is a GOOD shot; a contested midrange (~0.8) is bad.
    return "good" if xp >= 1.12 else ("mid" if xp >= 0.90 else "bad")

def export_json(df, proba, board, league_ft, season, path="players.json"):
    d = df.copy(); d["pmake"] = proba
    qualified = set(board["PLAYER_ID"])
    shots = {}
    for pid, sub in d[d["PLAYER_ID"].isin(qualified)].groupby("PLAYER_ID"):
        shots[int(pid)] = [{"x":int(r.LOC_X), "y":int(r.LOC_Y),
                            "m":int(r.SHOT_MADE_FLAG), "v":int(r.SHOT_VALUE),
                            "xp":round(r.pmake*r.SHOT_VALUE, 2),
                            "q":quality(r.pmake*r.SHOT_VALUE, r.SHOT_DISTANCE)}
                           for r in sub.itertuples()]
    players = [{
        "id":int(r.PLAYER_ID), "name":r.PLAYER_NAME,
        "team":getattr(r,"team",""), "shots":int(r.shots),
        "actual":round(r.fg_actual + r.FTM, 1),
        "expected":round(r.fg_expected + r.ft_expected, 1),
        "fg_diff":round(r.fg_diff,1), "ft_diff":round(r.ft_diff,1),
        "diff":round(r.diff,1), "per100":round(r.per100,1),
        "per100_base":round(r.per100_base,1), "openness_adj":round(r.openness_adj,1),
        "verdict":r.label, "cat":r.cat,
    } for r in board.itertuples()]
    out = {"season":season, "generated":datetime.date.today().isoformat(),
           "league_ft_pct":round(league_ft,3), "players":players, "shots":shots}
    with open(path,"w") as f: json.dump(out, f)
    print(f"\nExported {len(players)} players + shots -> {path} "
          f"({len(json.dumps(out))/1e6:.1f} MB)")

# ----------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--season", default=None)
    ap.add_argument("--synthetic", action="store_true")
    ap.add_argument("--min-att", type=int, default=200)
    ap.add_argument("--out", default="players.json")
    ap.add_argument("--v2", action="store_true", help="add player-level openness (defender-distance) adjustment")
    a = ap.parse_args()

    if a.season and not a.synthetic:
        print(f"Pulling {a.season} ...")
        raw, ft = fetch_shots_nba(a.season), fetch_player_ft_nba(a.season)
        season = a.season
    else:
        print("Synthetic mode (offline) ...")
        raw = synthetic_shots(); ft = synthetic_ft(raw); season = "synthetic"
    print(f"{len(raw):,} shots, {raw['PLAYER_NAME'].nunique()} players\n")

    op_adj = None
    if a.v2:
        print("v2: pulling closest-defender (openness) splits ...")
        op = synthetic_openness(raw) if season == "synthetic" else fetch_openness_nba(season)
        op_adj, pps, lpps = compute_openness_adjustment(op)
        print("  league pts/shot by openness:", {k: round(v, 3) for k, v in pps.items()})
        print(f"  league avg pts/shot: {lpps:.3f}")
        c = op_adj["contested_share"].corr(op_adj["openness_adj"])
        print(f"  [validation] corr(contested share, credit) = {c:.2f}  (should be positive)\n")

    df, X, y = build_features(raw)
    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=0, stratify=y)
    model = make_model().fit(Xtr, ytr)
    p = model.predict_proba(Xte)[:,1]
    print(f"Model: logloss={log_loss(yte,p):.4f}  AUC={roc_auc_score(yte,p):.4f}  "
          f"brier={brier_score_loss(yte,p):.4f}  (frozen)\n")

    proba_all = model.predict_proba(X)[:,1]
    board, league_ft = leaderboard(df, proba_all, ft, a.min_att, openness=op_adj)
    print(f"League FT% baseline: {league_ft:.3f}")

    cols = ["PLAYER_NAME","shots","fg_diff","ft_diff","per100_base","openness_adj","per100","label"]
    print("\nTop 10 (v2: base grade + openness):")
    print(board.head(10)[cols].round(1).to_string(index=False))
    print("\nBottom 10:")
    print(board.tail(10)[cols].round(1).to_string(index=False))

    if a.v2:
        moved = board.assign(jump=board["openness_adj"]).sort_values("jump", ascending=False)
        print("\nBiggest openness BOOSTS (most contested shot diets):")
        print(moved.head(5)[["PLAYER_NAME","per100_base","openness_adj","per100"]].round(1).to_string(index=False))
        print("\nBiggest openness DOCKS (most open looks):")
        print(moved.tail(5)[["PLAYER_NAME","per100_base","openness_adj","per100"]].round(1).to_string(index=False))

    if "_TRUE_SKILL" in df:
        print(f"\n[validation] corr(per100, hidden skill) = "
              f"{board[['per100','true_skill']].corr().iloc[0,1]:.2f}")

    export_json(df, proba_all, board, league_ft, season, a.out)

if __name__ == "__main__":
    main()
