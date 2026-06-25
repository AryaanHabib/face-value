"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Court from "../../components/Court";

const QUAL = [
  ["good", "Good"],
  ["mid", "OK"],
  ["bad", "Bad"],
];

export default function Player() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [mode, setMode] = useState("scatter"); // scatter | zones
  const [result, setResult] = useState("all"); // all | made | miss
  const [qual, setQual] = useState(new Set(["good", "mid", "bad"]));

  useEffect(() => {
    fetch("/players.json")
      .then((r) => r.json())
      .then(setData);
  }, []);

  const all = (data && data.shots[id]) || [];
  const shots = useMemo(
    () =>
      all.filter(
        (s) =>
          (result === "all" ||
            (result === "made" && s.m) ||
            (result === "miss" && !s.m)) &&
          (qual.has(s.q) || s.q === "heave"),
      ),
    [all, result, qual],
  );

  if (!data) return <div className="loading">loading…</div>;
  const p = data.players.find((x) => String(x.id) === String(id));
  if (!p)
    return (
      <div className="wrap">
        <Link className="back" href="/">
          ← back
        </Link>
        <p>Player not found.</p>
      </div>
    );
  const pos = p.per100 >= 0;
  const toggleQ = (k) => {
    const n = new Set(qual);
    n.has(k) ? n.delete(k) : n.add(k);
    setQual(n);
  };

  return (
    <>
      <div className="head">
        <div>
          <div className="mark" style={{ fontSize: 17 }}>
            {p.name}
          </div>
          <div className="tagline">
            {p.team} · {p.shots} FGA
          </div>
        </div>
        <div
          className="meta"
          style={{
            fontFamily: "var(--disp)",
            fontWeight: 700,
            fontSize: 16,
            color: pos ? "var(--up)" : "var(--down)",
          }}
        >
          {pos ? "▲ +" : "▼ "}
          {p.per100}
        </div>
      </div>
      <div className="wrap">
        <Link className="back" href="/">
          ← back to the market
        </Link>
        <div>
          <span className={"tag " + p.cat} style={{ marginBottom: 14 }}>
            {p.verdict}
          </span>
        </div>

        {p.openness_adj != null && (
          <div className="v2box">
            <div className="v2row">
              <span className="v2k">Base grade</span>
              <span className="v2v">
                {p.per100_base >= 0 ? "+" : ""}
                {p.per100_base}
              </span>
            </div>
            <div className="v2row">
              <span className="v2k">
                Openness adj.
                <small>
                  {p.openness_adj >= 0
                    ? "took harder shots than avg"
                    : "lived on easier looks"}
                </small>
              </span>
              <span
                className="v2v"
                style={{
                  color: p.openness_adj >= 0 ? "var(--up)" : "var(--down)",
                }}
              >
                {p.openness_adj >= 0 ? "+" : ""}
                {p.openness_adj}
              </span>
            </div>
            <div className="v2row v2total">
              <span className="v2k">Final / 100</span>
              <span
                className="v2v"
                style={{ color: p.per100 >= 0 ? "var(--up)" : "var(--down)" }}
              >
                {p.per100 >= 0 ? "+" : ""}
                {p.per100}
              </span>
            </div>
          </div>
        )}

        <div className="seg">
          {[
            ["scatter", "Every shot"],
            ["zones", "Hot zones"],
          ].map(([k, l]) => (
            <button
              key={k}
              className={mode === k ? "on" : ""}
              onClick={() => setMode(k)}
            >
              {l}
            </button>
          ))}
        </div>

        {mode === "scatter" && (
          <div className="chips">
            {[
              ["all", "All"],
              ["made", "Made"],
              ["miss", "Missed"],
            ].map(([k, l]) => (
              <button
                key={k}
                className={"qchip " + (result === k ? "on" : "")}
                onClick={() => setResult(k)}
              >
                {l}
              </button>
            ))}
            <span style={{ width: 8 }} />
            {QUAL.map(([k, l]) => (
              <button
                key={k}
                className={"qchip " + (qual.has(k) ? "on" : "")}
                onClick={() => toggleQ(k)}
              >
                {l}
              </button>
            ))}
          </div>
        )}

        <div className="court-card">
          <Court shots={mode === "zones" ? all : shots} mode={mode} />
          <div className="ppsrow">
            <div className="pps">
              <div className="k">Actual</div>
              <div className="v">{p.actual}</div>
            </div>
            <div className="pps">
              <div className="k">Expected</div>
              <div className="v">{p.expected}</div>
            </div>
            <div className="pps">
              <div className="k">Gap</div>
              <div
                className="v"
                style={{ color: pos ? "var(--up)" : "var(--down)" }}
              >
                {pos ? "+" : ""}
                {p.diff}
              </div>
            </div>
          </div>
          <div className="legend">
            {mode === "zones" ? (
              <>
                <span>size = volume</span>
                <span>
                  <i style={{ background: "#1FC288" }} />
                  beat expected
                </span>
                <span>
                  <i style={{ background: "#E8A33D" }} />
                  even
                </span>
                <span>
                  <i style={{ background: "#FF5B52" }} />
                  below expected
                </span>
              </>
            ) : (
              <>
                <span>
                  <i style={{ background: "#1FC288" }} />
                  good shot
                </span>
                <span>
                  <i style={{ background: "#E8A33D" }} />
                  ok shot
                </span>
                <span>
                  <i style={{ background: "#FF5B52" }} />
                  bad shot
                </span>
                <span>
                  <i style={{ background: "#A878E0" }} />
                  heave
                </span>
              </>
            )}
          </div>
        </div>
        <p className="tagline" style={{ marginTop: 12, textAlign: "center" }}>
          {mode === "scatter"
            ? `colored by shot quality \u00b7 ${shots.length} of ${all.length} shots`
            : "size = how often he shoots there \u00b7 color = scored above/below expected"}{" "}
        </p>
      </div>
    </>
  );
}
