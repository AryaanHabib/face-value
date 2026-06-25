"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Court from "../components/Court";
import Head from "../components/Head";

export default function Compare() {
  const [data, setData] = useState(null);
  const [aId, setAId] = useState(null);
  const [bId, setBId] = useState(null);

  useEffect(() => {
    fetch("/players.json").then(r => r.json()).then(d => {
      setData(d);
      setAId(d.players[0]?.id);
      setBId(d.players[1]?.id);
    });
  }, []);

  const sorted = useMemo(() =>
    data ? [...data.players].sort((x, y) => x.name.localeCompare(y.name)) : [], [data]);

  if (!data) return <div className="loading">loading…</div>;
  const A = data.players.find(p => p.id === aId);
  const B = data.players.find(p => p.id === bId);
  const winner = A && B ? (A.per100 === B.per100 ? null : A.per100 > B.per100 ? "a" : "b") : null;

  return (
    <>
      <div className="head">
        <div><div className="mark">FACEVALUE<span className="v">.</span></div>
          <div className="tagline">head to head</div></div>
        <Link className="meta" href="/">← market</Link>
      </div>
      <div className="wrap">
        <div className="cmp">
          <Side data={data} list={sorted} pick={aId} setPick={setAId} player={A} win={winner === "a"} />
          <div className="cmp-vs">VS</div>
          <Side data={data} list={sorted} pick={bId} setPick={setBId} player={B} win={winner === "b"} />
        </div>
      </div>
    </>
  );
}

function Side({ data, list, pick, setPick, player, win }) {
  if (!player) return <div className="cmp-col" />;
  const pos = player.per100 >= 0;
  return (
    <div className={"cmp-col" + (win ? " win" : "")}>
      <select className="sel cmp-sel" value={pick} onChange={e => setPick(Number(e.target.value))}>
        {list.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <div className="cmp-id">
        <Head id={player.id} name={player.name} size={64} ring={pos ? "var(--up)" : "var(--down)"} />
        <div className="cmp-name">{player.name}</div>
        <div className="cmp-team">{player.team}</div>
      </div>
      <div className={"cmp-grade " + (pos ? "up" : "down")}>{pos ? "+" : ""}{player.per100}</div>
      <span className={"tag " + player.cat} style={{ margin: "0 auto 12px", display: "table" }}>{player.verdict}</span>
      <div className="court-card" style={{ padding: 8 }}>
        <Court shots={data.shots[player.id] || []} />
      </div>
      <div className="cmp-stats">
        <Row k="Base" v={player.per100_base} sign />
        <Row k="Openness" v={player.openness_adj} sign color />
        <Row k="FT add" v={player.ft_diff} sign color />
        <Row k="Shots" v={player.shots} />
      </div>
    </div>
  );
}

function Row({ k, v, sign, color }) {
  const c = color ? (v >= 0 ? "var(--up)" : "var(--down)") : "var(--ink)";
  return (
    <div className="cmp-row">
      <span>{k}</span>
      <span style={{ color: c, fontFamily: "var(--disp)", fontWeight: 700 }}>
        {sign && v >= 0 ? "+" : ""}{v}</span>
    </div>
  );
}
