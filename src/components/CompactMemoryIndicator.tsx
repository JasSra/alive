"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { getMetrics, type ServerMetrics } from "@/lib/api";

type Point = { t: number; v: number };

interface CompactMemoryIndicatorProps {
  className?: string;
}

export default function CompactMemoryIndicator({ className = "" }: CompactMemoryIndicatorProps) {
  const [metrics, setMetrics] = useState<ServerMetrics | null>(null);
  const [series, setSeries] = useState<Point[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
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
          // keep last ~30 points for mini display
          return next.slice(-30);
        });
      } catch {
        // ignore errors for the widget
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
    const w = 60;
    const h = 20;
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
    <div className={`${className}`}>
      <div 
        className="inline-flex items-center gap-2 px-3 py-2 bg-black/40 backdrop-blur-sm border border-white/10 rounded-lg cursor-pointer hover:bg-black/60 transition-all duration-200"
        onClick={() => setIsExpanded(!isExpanded)}
        title="Click to expand memory details"
      >
        {/* Mini Chart */}
        <svg width="60" height="20" viewBox="0 0 60 20" className="opacity-70">
          <defs>
            <linearGradient id="miniMemGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.2" />
            </linearGradient>
          </defs>
          {pathD && (
            <path 
              d={pathD} 
              stroke="url(#miniMemGradient)" 
              strokeWidth="1.5" 
              fill="none" 
              strokeLinecap="round" 
            />
          )}
        </svg>

        {/* Compact Text */}
        <div className="text-xs text-white/90 font-mono">
          <span className="text-emerald-300">{heap.toFixed(1)}MB</span>
        </div>

        {/* Expand/Collapse Icon */}
        <svg 
          className={`w-3 h-3 text-white/60 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="absolute top-full left-0 mt-2 p-4 bg-gray-900/95 backdrop-blur-sm border border-white/10 rounded-lg shadow-xl z-50 min-w-64">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">System Memory</h3>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(false);
                }}
                className="text-gray-400 hover:text-white transition-colors"
                title="Close"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Detailed Chart */}
            <svg width="220" height="60" viewBox="0 0 220 60" className="border border-white/10 rounded bg-black/20">
              <defs>
                <linearGradient id="detailedMemGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.1" />
                </linearGradient>
              </defs>
              {series.length > 1 && (
                <path 
                  d={(() => {
                    const w = 218;
                    const h = 58;
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
                  })()} 
                  stroke="url(#detailedMemGradient)" 
                  strokeWidth="2" 
                  fill="none" 
                  strokeLinecap="round" 
                />
              )}
            </svg>

            {/* Memory Stats */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-white/5 rounded-lg p-2">
                <div className="text-gray-400">Heap Used</div>
                <div className="text-emerald-300 font-mono font-bold">{heap.toFixed(1)} MB</div>
              </div>
              <div className="bg-white/5 rounded-lg p-2">
                <div className="text-gray-400">RSS Memory</div>
                <div className="text-cyan-300 font-mono font-bold">{rss.toFixed(1)} MB</div>
              </div>
              <div className="bg-white/5 rounded-lg p-2 col-span-2">
                <div className="text-gray-400">Events (5m)</div>
                <div className="text-fuchsia-300 font-mono font-bold">{recent.toLocaleString()}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
