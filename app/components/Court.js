const COLOR = { good: "#1FC288", mid: "#E8A33D", bad: "#FF5B52", heave: "#A878E0" };
const EXP = { good: 0.56, mid: 0.42, bad: 0.31, heave: 0.05 };

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

// flat-topped hexagon path centered at (cx,cy) with radius r
function hexPath(cx, cy, r) {
  let d = "";
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i);
    const px = cx + r * Math.cos(a), py = cy + r * Math.sin(a);
    d += (i === 0 ? "M" : "L") + px.toFixed(1) + " " + py.toFixed(1);
  }
  return d + "Z";
}

export default function Court({ shots = [], mode = "scatter" }) {
  if (mode === "zones") {
    // hexbin: bucket shots into a hex grid; size = frequency, color = value vs expected
    const R = 11;                                   // hex cell radius
    const dx = R * 1.5, dy = R * Math.sqrt(3);
    const cells = {};
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
          const ou = (c.act - c.exp) / c.n;                       // value vs expected
          const fill = ou >= 0.05 ? COLOR.good : ou <= -0.05 ? COLOR.bad : COLOR.mid;
          const size = R * (0.42 + 0.58 * Math.sqrt(c.n / maxN)); // size = frequency
          return <path key={i} d={hexPath(c.cx, c.cy, size)} fill={fill}
            opacity={0.85} stroke="#13171A" strokeWidth="0.5" />;
        })}
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 300 250" className="court" aria-label="shot chart">
      <CourtLines />
      {shots.map((s, i) => (
        <circle key={i} cx={mapX(s.x)} cy={mapY(s.y)} r={s.q === "heave" ? 4 : 3.4}
          fill={COLOR[s.q] || "#999"} opacity={s.m ? 0.92 : 0.32}
          stroke={s.m ? "none" : (COLOR[s.q] || "#999")} strokeWidth={s.m ? 0 : 0.6} />
      ))}
    </svg>
  );
}
