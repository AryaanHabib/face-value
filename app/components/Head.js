"use client";
import { useState } from "react";

// NBA player headshot by id, with an initials fallback if missing.
export default function Head({ id, name = "", size = 40, ring }) {
  const [err, setErr] = useState(false);
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("");
  const style = { width: size, height: size, borderColor: ring || "transparent" };
  if (err || !id)
    return <div className="head-av fallback" style={{ ...style, fontSize: size * 0.34 }}>{initials}</div>;
  return (
    <img className="head-av" style={style}
      src={`https://cdn.nba.com/headshots/nba/latest/1040x760/${id}.png`}
      alt={name} onError={() => setErr(true)} loading="lazy" />
  );
}
