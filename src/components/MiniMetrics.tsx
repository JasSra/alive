"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { getMetrics, type ServerMetrics } from "@/lib/api";
import styles from "./MiniMetrics.module.css";

type Point = { t: number; v: number };

export default function MiniMetrics() {
  const [metrics, setMetrics] = useState<ServerMetrics | null>(null);
  const [series, setSeries] = useState<Point[]>([]);
  const timer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let mounted = true;
    const tick = async () => {
      try {
        const m = await getMetrics();
        if (!mounted) return;
        setMetrics(m);
        setSeries((prev) => {
          const next = [...prev, { t: m.timestamp, v: m.memory.heapUsedMB }];
          // keep last ~60 points (~5 minutes if 5s interval)
          return next.slice(-60);
        });
      } catch {
        // ignore errors for the tiny widget
      }
    };
    tick();
    timer.current = setInterval(tick, 5000);
    return () => {
      mounted = false;
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  const pathD = useMemo(() => {
    if (series.length < 2) return "";
    const w = 120;
    const h = 28;
    const min = Math.min(...series.map((p) => p.v));
    const max = Math.max(...series.map((p) => p.v));
    const span = Math.max(1e-6, max - min);
    const xs = (i: number) => (i / (series.length - 1)) * (w - 2) + 1;
    const ys = (v: number) => h - 1 - ((v - min) / span) * (h - 2);
    let d = `M ${xs(0)} ${ys(series[0].v)}`;
    for (let i = 1; i < series.length; i += 1) {
      d += ` L ${xs(i)} ${ys(series[i].v)}`;
    }
    return d;
  }, [series]);

  const heap = metrics?.memory.heapUsedMB ?? 0;
  const rss = metrics?.memory.rssMB ?? 0;
  const recent = metrics?.eventsLast5m ?? 0;

  return (
  <div className={`${styles.root} select-none`}>
      <div className="rounded-md border border-white/10 bg-black/60 backdrop-blur px-3 py-2 shadow">
        <div className="flex items-center gap-3">
          <svg width="120" height="28" viewBox="0 0 120 28" className="opacity-80">
            <defs>
              <linearGradient id="mmg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34d399" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#34d399" stopOpacity="0.2" />
              </linearGradient>
            </defs>
            <rect x="0" y="0" width="120" height="28" rx="3" ry="3" fill="transparent" stroke="#22d3ee22" />
            {pathD && (
              <path d={pathD} stroke="url(#mmg)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            )}
          </svg>
          <div className="text-xs leading-tight text-white/90">
            <div>
              heap <span className="text-emerald-300">{heap.toFixed(1)} MB</span>
            </div>
            <div className="opacity-80">
              rss <span className="text-cyan-300">{rss.toFixed(1)} MB</span>
            </div>
            <div className="opacity-80">
              5m <span className="text-fuchsia-300">{recent}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
