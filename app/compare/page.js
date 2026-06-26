"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Court from "../components/Court";
import Head from "../components/Head";

const last = (n) => n.split(" ").slice(-1)[0];

function diet(shots = []) {
  let rim = 0, mid = 0, three = 0, n = 0;
  shots.forEach((s) => {
    if (s.q === "heave") return;
    n++;
    const d = Math.hypot(s.x, s.y) / 10;
    if (s.v === 3) three++; else if (d <= 8) rim++; else mid++;
  });
  if (!n) return { rim: 0, mid: 0, three: 0 };
  return { rim: Math.round(rim / n * 100), mid: Math.round(mid / n * 100), three: Math.round(three / n * 100) };
}

function verdictLine(A, B) {
  const lead = A.per100 >= B.per100 ? A : B, trail = lead === A ? B : A;
  const drivers = [
    { n: "pure shot-making", d: lead.per100_base - trail.per100_base },
    { n: "the free-throw line", d: lead.ft_diff - trail.ft_diff },
    { n: "shot difficulty faced", d: lead.openness_adj - trail.openness_adj },
  ];
  const pos = drivers.filter(x => x.d > 0.3).sort((a, b) => b.d - a.d);
  const neg = drivers.filter(x => x.d < -0.3).sort((a, b) => a.d - b.d);
  return (
    <>
      <b>{last(lead.name)}</b> grades out higher overall (+{(lead.per100 - trail.per100).toFixed(1)}/100).
      {pos[0] && <> The edge is mostly <b>{pos[0].n}</b> (+{pos[0].d.toFixed(1)}).</>}
      {neg[0] && <> But <b>{last(trail.name)}</b> wins <b>{neg[0].n}</b> (+{Math.abs(neg[0].d).toFixed(1)}).</>}
    </>
  );
}

export default function Compare() {
  const [data, setData] = useState(null);
  const [aId, setAId] = useState(null);
  const [bId, setBId] = useState(null);

  useEffect(() => {
    fetch("/players.json").then(r => r.json()).then(d => {
      setData(d); setAId(d.players[0]?.id); setBId(d.players[1]?.id);
    });
  }, []);

  const sorted = useMemo(() =>
    data ? [...data.players].sort((x, y) => x.name.localeCompare(y.name)) : [], [data]);

  if (!data) return <div className="loading">loading…</div>;
  const A = data.players.find(p => p.id === aId);
  const B = data.players.find(p => p.id === bId);
  if (!A || !B) return <div className="loading">loading…</div>;
  const dietA = diet(data.shots[A.id]), dietB = diet(data.shots[B.id]);

  return (
    <>
      <div className="head">
        <div><div className="mark">FACEVALUE<span className="v">.</span></div>
          <div className="tagline">head to head</div></div>
        <Link className="meta" href="/">← market</Link>
      </div>
      <div className="wrap">
        {/* identity row */}
        <div className="cmp">
          <Identity p={A} list={sorted} pick={aId} setPick={setAId} win={A.per100 >= B.per100} />
          <div className="cmp-vs">VS</div>
          <Identity p={B} list={sorted} pick={bId} setPick={setBId} win={B.per100 > A.per100} />
        </div>

        {/* auto verdict */}
        <div className="verdict-line">{verdictLine(A, B)}</div>

        {/* diff bars */}
        <div className="cmp-insight">
          <p className="eyebrow"><span>Who wins each part</span></p>
          <DiffBar k="Final / 100" a={A.per100} b={B.per100} A={A} B={B} />
          <DiffBar k="Base · shot-making" a={A.per100_base} b={B.per100_base} A={A} B={B} />
          <DiffBar k="Openness adj." a={A.openness_adj} b={B.openness_adj} A={A} B={B} />
          <DiffBar k="Free-throw add" a={A.ft_diff} b={B.ft_diff} A={A} B={B} />
        </div>

        {/* shot diet */}
        <div className="cmp-insight">
          <p className="eyebrow"><span>Shot diet</span><span>rim · mid · three</span></p>
          <Diet name={last(A.name)} d={dietA} />
          <Diet name={last(B.name)} d={dietB} />
          <div className="diet-legend">
            <span><i style={{ background: "#4F91E0" }} />rim</span>
            <span><i style={{ background: "#E8A33D" }} />mid</span>
            <span><i style={{ background: "#A878E0" }} />three</span>
          </div>
        </div>

        {/* charts */}
        <div className="cmp-charts">
          <div className="court-card" style={{ padding: 8 }}><Court shots={data.shots[A.id] || []} /></div>
          <div className="court-card" style={{ padding: 8 }}><Court shots={data.shots[B.id] || []} /></div>
        </div>
      </div>
    </>
  );
}

function Identity({ p, list, pick, setPick, win }) {
  const pos = p.per100 >= 0;
  return (
    <div className={"cmp-col" + (win ? " win" : "")}>
      <select className="sel cmp-sel" value={pick} onChange={e => setPick(Number(e.target.value))}>
        {list.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
      </select>
      <div className="cmp-id">
        <Head id={p.id} name={p.name} size={60} ring={pos ? "var(--up)" : "var(--down)"} />
        <div className="cmp-name">{p.name}</div>
        <div className="cmp-team">{p.team}</div>
      </div>
      <div className={"cmp-grade " + (pos ? "up" : "down")}>{pos ? "+" : ""}{p.per100}</div>
      <span className={"tag " + p.cat} style={{ margin: "0 auto", display: "table" }}>{p.verdict}</span>
    </div>
  );
}

function DiffBar({ k, a, b, A, B }) {
  const aWin = a >= b, gap = Math.abs(a - b);
  const w = Math.min(50, (gap / Math.max(Math.abs(a), Math.abs(b), 1)) * 50);
  return (
    <div className="db">
      <div className="db-top">
        <span>{k}</span>
        <span className="db-lead">{aWin ? last(A.name) : last(B.name)} +{gap.toFixed(1)}</span>
      </div>
      <div className="db-track">
        <span className="db-val r" style={{ color: aWin ? "var(--up)" : "var(--muted)" }}>{a >= 0 ? "+" : ""}{a}</span>
        <div className="db-bar">
          <div className="db-zero" />
          <div className="db-fill" style={aWin ? { right: "50%", width: w + "%" } : { left: "50%", width: w + "%" }} />
        </div>
        <span className="db-val" style={{ color: !aWin ? "var(--up)" : "var(--muted)" }}>{b >= 0 ? "+" : ""}{b}</span>
      </div>
    </div>
  );
}

function Diet({ name, d }) {
  const segs = [["rim", d.rim, "#4F91E0"], ["mid", d.mid, "#E8A33D"], ["three", d.three, "#A878E0"]];
  return (
    <div className="diet-row">
      <div className="diet-name"><span>{name}</span></div>
      <div className="diet-bar">
        {segs.map(([key, val, c]) => val > 0 && (
          <div key={key} className="diet-seg" style={{ width: val + "%", background: c }}>{val >= 12 ? val + "%" : ""}</div>
        ))}
      </div>
    </div>
  );
}
