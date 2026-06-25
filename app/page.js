"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Court from "./components/Court";

export default function Home() {
  const [data, setData] = useState(null);
  const [q, setQ] = useState("");
  const [team, setTeam] = useState("ALL");
  const [view, setView] = useState("all"); // all | good | bad

  useEffect(() => {
    fetch("/players.json")
      .then((r) => r.json())
      .then(setData);
  }, []);

  const teams = useMemo(
    () =>
      data
        ? [
            "ALL",
            ...Array.from(new Set(data.players.map((p) => p.team))).sort(),
          ]
        : ["ALL"],
    [data],
  );

  const filtered = useMemo(() => {
    if (!data) return [];
    const out = data.players.filter(
      (p) =>
        (team === "ALL" || p.team === team) &&
        (view === "all" ||
          (view === "good" && p.per100 > 0) ||
          (view === "bad" && p.per100 < 0)) &&
        (q === "" || p.name.toLowerCase().includes(q.toLowerCase())),
    );
    if (view === "bad") out.sort((a, b) => a.per100 - b.per100); // most overvalued first
    return out;
  }, [data, q, team, view]);

  if (!data)
    return (
      <>
        <Header />
        <div className="loading">loading the market…</div>
      </>
    );

  const hero = filtered[0];
  const max = Math.max(...data.players.map((p) => Math.abs(p.per100))) || 1;
  const movers = [...data.players.slice(0, 6), ...data.players.slice(-4)];

  return (
    <>
      <Header season={data.season} />
      <div className="ticker">
        <span className="run">
          {[...movers, ...movers].map((p, i) => (
            <span className="it" key={i}>
              <span className={p.per100 >= 0 ? "up" : "down"}>
                {p.per100 >= 0 ? "▲" : "▼"}{" "}
              </span>
              <span className="nm">{p.name.split(" ").slice(-1)[0]} </span>
              <span className={p.per100 >= 0 ? "up" : "down"}>
                {p.per100 >= 0 ? "+" : ""}
                {p.per100}
              </span>
            </span>
          ))}
        </span>
      </div>

      <div className="wrap">
        <div className="tools">
          <input
            className="search"
            placeholder="Search a player…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            className="sel"
            value={team}
            onChange={(e) => setTeam(e.target.value)}
          >
            {teams.map((t) => (
              <option key={t} value={t}>
                {t === "ALL" ? "All teams" : t}
              </option>
            ))}
          </select>
        </div>
        <div className="seg">
          {[
            ["all", "All"],
            ["good", "Undervalued"],
            ["bad", "Overvalued"],
          ].map(([k, l]) => (
            <button
              key={k}
              className={view === k ? "on" : ""}
              onClick={() => setView(k)}
            >
              {l}
            </button>
          ))}
        </div>

        {hero && (
          <>
            <p className="eyebrow">
              <span>Top read</span>
              <span>{hero.team}</span>
            </p>
            <Link href={`/player/${hero.id}`}>
              <div className={"hero " + (hero.per100 >= 0 ? "" : "dn")}>
                <div className="top">
                  <div>
                    <div className="pname">{hero.name}</div>
                    <div className="pmeta">
                      {hero.team} · {hero.shots} FGA
                    </div>
                  </div>
                  <div style={{ width: 104, flex: "none" }}>
                    <Court shots={(data.shots[hero.id] || []).slice(0, 80)} />
                  </div>
                </div>
                <div className="quote">
                  <span className={"n " + (hero.per100 >= 0 ? "up" : "down")}>
                    {hero.per100 >= 0 ? "+" : ""}
                    {hero.per100}
                  </span>
                  <span className="u">pts / 100 shots vs expected</span>
                </div>
                <span className={"tag " + hero.cat}>{hero.verdict}</span>
                <div className="splitrow">
                  <div className="stat">
                    <div className="k">Actual</div>
                    <div className="vv">{hero.actual}</div>
                  </div>
                  <div className="stat">
                    <div className="k">Expected</div>
                    <div className="vv">{hero.expected}</div>
                  </div>
                  <div className="stat">
                    <div className="k">FT add</div>
                    <div
                      className="vv"
                      style={{
                        color: hero.ft_diff >= 0 ? "var(--up)" : "var(--down)",
                      }}
                    >
                      {hero.ft_diff >= 0 ? "+" : ""}
                      {hero.ft_diff}
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          </>
        )}

        <div className="board">
          <p className="eyebrow">
            <span>The market</span>
            <span>{filtered.length} players</span>
          </p>
          {filtered.map((p, idx) => {
            const pos = p.per100 >= 0,
              w = (Math.abs(p.per100) / max) * 50;
            return (
              <Link className="brow" key={p.id} href={`/player/${p.id}`}>
                <span className="rank">{idx + 1}</span>
                <div className="bname">
                  {p.name}
                  <small>{p.team}</small>
                </div>
                <div className="track">
                  <div className="zero" />
                  <div
                    className={"bar " + (pos ? "pos" : "neg")}
                    style={
                      pos
                        ? { left: "50%", width: w + "%" }
                        : { right: "50%", width: w + "%" }
                    }
                  />
                  <div
                    className="bval"
                    style={{
                      color: pos ? "var(--up)" : "var(--down)",
                      [pos ? "left" : "right"]: `calc(50% + ${w}% + 8px)`,
                    }}
                  >
                    {pos ? "▲ +" : "▼ "}
                    {p.per100}
                  </div>
                </div>
              </Link>
            );
          })}
          {filtered.length === 0 && (
            <div className="loading">no players match — clear the filters</div>
          )}
        </div>
      </div>
    </>
  );
}

function Header({ season }) {
  return (
    <div className="head">
      <div>
        <div className="mark">
          FACEVALUE<span className="v">.</span>
        </div>
        <div className="tagline">the box score lies</div>
      </div>
      <div className="meta">{season || "—"}</div>
    </div>
  );
}
