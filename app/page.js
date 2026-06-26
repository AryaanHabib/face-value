"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Court from "./components/Court";
import Head from "./components/Head";
import CountUp from "./components/CountUp";

export default function Home() {
  const [data, setData] = useState(null);
  const [q, setQ] = useState("");
  const [team, setTeam] = useState("ALL");
  const [view, setView] = useState("all"); // all | good | bad
  const [info, setInfo] = useState(false);

  useEffect(() => { fetch("/players.json").then(r => r.json()).then(setData); }, []);

  const teams = useMemo(() =>
    data ? ["ALL", ...Array.from(new Set(data.players.map(p => p.team))).sort()] : ["ALL"], [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const out = data.players.filter(p =>
      (team === "ALL" || p.team === team) &&
      (view === "all" || (view === "good" && p.per100 > 0) || (view === "bad" && p.per100 < 0)) &&
      (q === "" || p.name.toLowerCase().includes(q.toLowerCase())));
    if (view === "bad") out.sort((a, b) => a.per100 - b.per100); // most overvalued first
    return out;
  }, [data, q, team, view]);

  if (!data) return (<><Header /><div className="loading">loading the market…</div></>);

  const hero = filtered[0];
  const max = Math.max(...data.players.map(p => Math.abs(p.per100))) || 1;
  const movers = [...data.players.slice(0, 6), ...data.players.slice(-4)];

  return (
    <>
      <Header season={data.season} />
      <div className="ticker">
        <span className="run">
          {[...movers, ...movers].map((p, i) => (
            <span className="it" key={i}>
              <span className={p.per100 >= 0 ? "up" : "down"}>{p.per100 >= 0 ? "▲" : "▼"} </span>
              <span className="nm">{p.name.split(" ").slice(-1)[0]} </span>
              <span className={p.per100 >= 0 ? "up" : "down"}>{p.per100 >= 0 ? "+" : ""}{p.per100}</span>
            </span>
          ))}
        </span>
      </div>

      <div className="wrap">
        <div className="tools">
          <input className="search" placeholder="Search a player…" value={q} onChange={e => setQ(e.target.value)} />
          <select className="sel" value={team} onChange={e => setTeam(e.target.value)}>
            {teams.map(t => <option key={t} value={t}>{t === "ALL" ? "All teams" : t}</option>)}
          </select>
        </div>
        <div className="seg">
          {[["all", "All"], ["good", "Undervalued"], ["bad", "Overvalued"]].map(([k, l]) => (
            <button key={k} className={view === k ? "on" : ""} onClick={() => setView(k)}>{l}</button>
          ))}
        </div>
        <Link className="cmp-link" href="/compare">⚔  Compare two players head-to-head →</Link>

        <button className="info-toggle" onClick={() => setInfo(v => !v)}>
          {info ? "▾" : "▸"}  What is xPTS+?
        </button>
        {info && (
          <div className="info-panel">
            <p><b>xPTS+</b> is how many points a player scores <b>above or below expectation</b>, per 100 shots — given how hard their shots were.</p>
            <ul>
              <li>A model trained on ~219k shots rates every shot's difficulty (an open three counts more than a contested layup).</li>
              <li>It compares actual points (field goals + free throws) to that expectation.</li>
              <li>Then adjusts for how <b>contested</b> a player's shots were vs. the league.</li>
            </ul>
            <div className="info-scale">
              <span><b>0</b> average</span><span className="up"><b>+10</b> great</span><span className="up"><b>+20</b> elite</span><span className="down"><b>−15</b> cold</span>
            </div>
            <p className="info-foot">Measures scoring efficiency vs. shot difficulty — not playmaking, defense, or rebounding.</p>
          </div>
        )}

        {hero && (<>
          <p className="eyebrow"><span>Top read</span><span>{hero.team}</span></p>
          <Link href={`/player/${hero.id}`}>
            <div className={"hero " + (hero.per100 >= 0 ? "" : "dn")}>
              <div className="top">
                <div className="pname-row"><Head id={hero.id} name={hero.name} size={46} ring={hero.per100>=0?"var(--up)":"var(--down)"} />
                  <div><div className="pname">{hero.name}</div>
                  <div className="pmeta">{hero.team} · {hero.shots} FGA</div></div></div>
                <div style={{ width: 104, flex: "none" }}><Court shots={(data.shots[hero.id] || []).slice(0, 80)} /></div>
              </div>
              <div className="quote">
                <CountUp value={hero.per100} className={"n " + (hero.per100 >= 0 ? "up" : "down")} />
                <span className="u"><b>xPTS+</b>points per 100<br/>vs expected</span>
              </div>
              <span className={"tag " + hero.cat}>{hero.verdict}</span>
              <div className="splitrow">
                <div className="stat"><div className="k">Actual</div><div className="vv">{hero.actual}</div></div>
                <div className="stat"><div className="k">Expected</div><div className="vv">{hero.expected}</div></div>
                <div className="stat"><div className="k">FT add</div>
                  <div className="vv" style={{ color: hero.ft_diff >= 0 ? "var(--up)" : "var(--down)" }}>
                    {hero.ft_diff >= 0 ? "+" : ""}{hero.ft_diff}</div></div>
              </div>
            </div>
          </Link>
        </>)}

        <div className="board">
          <p className="eyebrow"><span>The market</span><span>{filtered.length} players</span></p>
          {filtered.map((p, idx) => {
            const pos = p.per100 >= 0;
            const w = Math.max(3, (Math.abs(p.per100) / max) * 100);
            return (
              <Link className="brow" key={p.id} href={`/player/${p.id}`}>
                <span className="rank">{idx + 1}</span>
                <Head id={p.id} name={p.name} size={34} />
                <div className="bcontent">
                  <div className="bhead">
                    <div className="bname"><span className="nm">{p.name}</span><small>{p.team}</small></div>
                    <div className={"bval " + (pos ? "up" : "down")}>
                      {pos ? "▲ +" : "▼ "}{p.per100}
                    </div>
                  </div>
                  <div className="btrack">
                    <div className={"bfill " + (pos ? "up" : "down")} style={{ width: w + "%" }} />
                  </div>
                </div>
              </Link>
            );
          })}
          {filtered.length === 0 && <div className="loading">no players match — clear the filters</div>}
        </div>
      </div>
    </>
  );
}

function Header({ season }) {
  return (
    <div className="head">
      <div><div className="mark">FACEVALUE<span className="v">.</span></div>
        <div className="tagline">the box score lies</div></div>
      <div className="meta">{season || "—"}</div>
    </div>
  );
}
