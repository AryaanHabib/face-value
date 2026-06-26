"use client";
import { useEffect, useRef, useState } from "react";

// animates a number from 0 to value (1 decimal), eased
export default function CountUp({ value = 0, duration = 700, sign = true, className }) {
  const [v, setV] = useState(0);
  const raf = useRef();
  useEffect(() => {
    const start = performance.now();
    cancelAnimationFrame(raf.current);
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const e = 1 - Math.pow(1 - t, 3);
      setV(value * e);
      if (t < 1) raf.current = requestAnimationFrame(tick); else setV(value);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value, duration]);
  return <span className={className}>{sign && value >= 0 ? "+" : ""}{v.toFixed(1)}</span>;
}
