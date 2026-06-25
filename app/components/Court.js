"use client";
import { useEffect, useState } from "react";

const COLOR = { good: "#1FC288", mid: "#E8A33D", bad: "#FF5B52", heave: "#A878E0" };
const EXP = { good: 0.56, mid: 0.42, bad: 0.31, heave: 0.05 };
const LABEL = { good: "good look", mid: "ok look", bad: "bad look", heave: "heave" };

const mapX = (x) => Math.max(8, Math.min(292, ((x + 250) / 500) * 300));
const mapY = (y) => {
  const v = 22 + (Math.min(Math.max(y, -20), 430) / 430) * 218;
  return Math.max(8, Math.min(240, v));
};

function CourtLines() {
  return (
    <g>
      <line x1="128" y1="12" x2="172" y2="12" className="cl solid" />
      <circle cx="150" cy="24" r="6" className="cl solid" />
      <rect x="115" y="8" width="70" height="92" className="cl" />
      <circle cx="150" cy="100" r="28" className="cl" />
      <line x1="32" y1="8" x2="32" y2="84" className="cl" />
      <line x1="268" y1="8" x2="268" y2="84" className="cl" />
      <path d="M32 84 Q150 250 268 84" className="cl" />
    </g>
  );
}

function hexPath(cx, cy, r) {
  let d = "";
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i);
    d += (i === 0 ? "M" : "L") + (cx + r * Math.cos(a)).toFixed(1) + " " + (cy + r * Math.sin(a)).toFixed(1);
  }
  return d + "Z";
}

export default function Court({ shots = [], mode = "scatter", interactive = false }) {
  const [hover, setHover] = useState(null);   // {x,y,s} in svg coords
  const [shown, setShown] = useState(interactive ? 0 : shots.length);

  // animated fill: reveal dots progressively when interactive
  useEffect(() => {
    if (!interactive || mode !== "scatter") { setShown(shots.length); return; }
    setShown(0);
    let n = 0;
    const step = Math.max(1, Math.round(shots.length / 28));
    const id = setInterval(() => {
      n += step;
      setShown(n);
      if (n >= shots.length) clearInterval(id);
    }, 26);
    return () => clearInterval(id);
  }, [shots, mode, interactive]);

  if (mode === "zones") {
    const R = 11, dx = R * 1.5, dy = R * Math.sqrt(3), cells = {};
    let maxN = 1;
    shots.forEach((s) => {
      if (s.q === "heave") return;
      const mx = mapX(s.x), my = mapY(s.y);
      const col = Math.round(mx / dx);
      const row = Math.round((my - (col % 2 ? dy / 2 : 0)) / dy);
      const cx = col * dx, cy = row * dy + (col % 2 ? dy / 2 : 0);
      const k = col + "_" + row;
      const c = cells[k] || (cells[k] = { cx, cy, n: 0, act: 0, exp: 0 });
      const v = s.v || 2;
      c.n++; c.act += s.m * v;
      c.exp += s.xp != null ? s.xp : (EXP[s.q] ?? 0.42) * v;
      if (c.n > maxN) maxN = c.n;
    });
    return (
      <svg viewBox="0 0 300 250" className="court" aria-label="shot frequency heatmap">
        <CourtLines />
        {Object.values(cells).filter((c) => c.n >= 2).map((c, i) => {
          const ou = (c.act - c.exp) / c.n;
          const fill = ou >= 0.05 ? COLOR.good : ou <= -0.05 ? COLOR.bad : COLOR.mid;
          const size = R * (0.42 + 0.58 * Math.sqrt(c.n / maxN));
          return <path key={i} d={hexPath(c.cx, c.cy, size)} fill={fill}
            opacity={0.85} stroke="#13171A" strokeWidth="0.5"
            style={{ animation: `pop .4s ease ${i * 6}ms both` }} />;
        })}
      </svg>
    );
  }

  const vis = shots.slice(0, shown);
  return (
    <div style={{ position: "relative" }}>
      <svg viewBox="0 0 300 250" className="court" aria-label="shot chart"
        onMouseLeave={() => setHover(null)}>
        <CourtLines />
        {vis.map((s, i) => {
          const cx = mapX(s.x), cy = mapY(s.y);
          return (
            <circle key={i} cx={cx} cy={cy} r={s.q === "heave" ? 4 : 3.4}
              fill={COLOR[s.q] || "#999"} opacity={s.m ? 0.92 : 0.32}
              stroke={s.m ? "none" : (COLOR[s.q] || "#999")} strokeWidth={s.m ? 0 : 0.6}
              style={interactive ? { cursor: "pointer", animation: "pop .25s ease both" } : undefined}
              onMouseEnter={interactive ? () => setHover({ cx, cy, s }) : undefined} />
          );
        })}
        {hover && <circle cx={hover.cx} cy={hover.cy} r="6.5" fill="none"
          stroke={COLOR[hover.s.q] || "#fff"} strokeWidth="1.4" />}
      </svg>
      {interactive && hover && (
        <div className="shottip" style={{
          left: `${(hover.cx / 300) * 100}%`, top: `${(hover.cy / 250) * 100}%` }}>
          <b>{hover.s.v === 3 ? "3PT" : "2PT"} · {LABEL[hover.s.q]}</b>
          <span>{hover.s.xp != null ? `worth ${hover.s.xp} pts` : ""} · {hover.s.m ? "made ✓" : "missed ✗"}</span>
        </div>
      )}
    </div>
  );
}
