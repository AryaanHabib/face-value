import Court from "./Court";

export default function VerdictCard({ p, shots = [] }) {
  const sign = p.per100 >= 0 ? "pos" : "neg";
  return (
    <div className="hero">
      <div className="top">
        <div>
          <div className="pname">{p.name}</div>
          <div className="pmeta">{p.team} &middot; {p.shots} FGA</div>
        </div>
        <div style={{ width: 110, flex: "none" }}><Court shots={shots.slice(0, 60)} /></div>
      </div>
      <div className="delta">
        <span className={"n " + sign}>{p.per100 >= 0 ? "+" : ""}{p.per100}</span>
        <span className="u">pts / 100 shots vs expected</span>
      </div>
      <span className={"stamp " + p.cat}>{p.verdict}</span>
      <div className="splitrow">
        <div className="stat"><div className="k">Actual</div><div className="vv">{p.actual}</div></div>
        <div className="stat"><div className="k">Expected</div><div className="vv">{p.expected}</div></div>
        <div className="stat"><div className="k">FT add</div>
          <div className="vv" style={{ color: p.ft_diff >= 0 ? "var(--good)" : "var(--bad)" }}>
            {p.ft_diff >= 0 ? "+" : ""}{p.ft_diff}</div></div>
      </div>
    </div>
  );
}
