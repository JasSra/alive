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
  const [memoryLimits, setMemoryLimits] = useState({ cap: 2000, usage: 0 });
  const timer = useRef<NodeJS.Timeout | null>(null);

  // Fetch memory limit information
  const fetchMemoryLimits = async () => {
    try {
      const response = await fetch('/api/memory');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setMemoryLimits({
            cap: data.storage.capacity,
            usage: data.storage.utilizationPercent
          });
        }
      }
    } catch {
      // Silently ignore errors for widget
    }
  };

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
    fetchMemoryLimits(); // Fetch limits on mount
    timer.current = setInterval(() => {
      tick();
      fetchMemoryLimits(); // Update limits periodically
    }, 5000);
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
    <div className={`relative ${className}`}>
      <div 
        className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-800/80 backdrop-blur-sm border border-slate-700/50 rounded-md cursor-pointer hover:bg-slate-700/60 transition-all duration-200 text-xs"
        onClick={() => setIsExpanded(!isExpanded)}
        title="Memory usage - Click to expand"
      >
        {/* Mini Chart */}
        <svg width="32" height="12" viewBox="0 0 32 12" className="opacity-80">
          <defs>
            <linearGradient id="miniMemGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.3" />
            </linearGradient>
          </defs>
          {pathD && (
            <path 
              d={(() => {
                if (series.length < 2) return "";
                const w = 30;
                const h = 10;
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
              stroke="url(#miniMemGradient)" 
              strokeWidth="1" 
              fill="none" 
              strokeLinecap="round" 
            />
          )}
        </svg>

        {/* Compact Text */}
        <span className="text-emerald-400 font-mono font-medium">
          {heap.toFixed(0)}
        </span>
        <span className="text-gray-400">MB</span>

        {/* Expand Icon */}
        <svg 
          className={`w-2.5 h-2.5 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Expanded Details Portal */}
      {isExpanded && (
        <div className="fixed inset-0 z-[60000]">
          {/* Backdrop for expanded memory panel */}
          <div 
            className="fixed inset-0 bg-transparent"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(false);
            }}
          />
          
          <div className="fixed top-16 right-4 p-3 bg-slate-800/95 backdrop-blur-lg border border-slate-700/50 rounded-lg shadow-xl z-[60001] w-72">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-white">Memory Usage</h3>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsExpanded(false);
                  }}
                  className="text-gray-400 hover:text-white transition-colors p-1 hover:bg-slate-700/50 rounded"
                  title="Close"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Detailed Chart */}
              <div className="bg-slate-900/50 rounded-md p-2">
                <svg width="100%" height="40" viewBox="0 0 260 40" className="w-full">
                  <defs>
                    <linearGradient id="detailedMemGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0.2" />
                    </linearGradient>
                  </defs>
                  {series.length > 1 && (
                    <path 
                      d={(() => {
                        const w = 258;
                        const h = 38;
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
                      strokeWidth="1.5" 
                      fill="none" 
                      strokeLinecap="round" 
                    />
                  )}
                </svg>
              </div>

              {/* Memory Stats - Compact Grid */}
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="bg-slate-900/50 rounded-md p-2 text-center">
                  <div className="text-gray-400 text-[10px] uppercase">Heap</div>
                  <div className="text-emerald-300 font-mono font-bold">{heap.toFixed(1)}</div>
                  <div className="text-gray-500 text-[10px]">MB</div>
                </div>
                <div className="bg-slate-900/50 rounded-md p-2 text-center">
                  <div className="text-gray-400 text-[10px] uppercase">RSS</div>
                  <div className="text-cyan-300 font-mono font-bold">{rss.toFixed(1)}</div>
                  <div className="text-gray-500 text-[10px]">MB</div>
                </div>
                <div className="bg-slate-900/50 rounded-md p-2 text-center">
                  <div className="text-gray-400 text-[10px] uppercase">Events</div>
                  <div className="text-fuchsia-300 font-mono font-bold text-[11px]">{recent.toLocaleString()}</div>
                  <div className="text-gray-500 text-[10px]">5m</div>
                </div>
              </div>

              {/* Memory Management Info */}
              <div className="mt-3 p-2 bg-slate-900/30 rounded-md border border-slate-700/30">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-gray-300 font-medium">Memory Management</span>
                  <span className="text-emerald-400 text-[10px] font-mono">Auto-cleanup enabled</span>
                </div>
                <div className="text-[10px] text-gray-400 space-y-1">
                  <div className="flex justify-between">
                    <span>Buffer limit per type:</span>
                    <span className="text-cyan-300 font-mono">
                      {memoryLimits.cap.toLocaleString()} items
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Buffer utilization:</span>
                    <span className={`font-mono ${memoryLimits.usage > 80 ? 'text-amber-400' : 'text-green-400'}`}>
                      {memoryLimits.usage}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Auto-discard old data:</span>
                    <span className="text-green-400">✓ Enabled</span>
                  </div>
                  <div className="text-amber-300 text-[9px] italic">
                    Set UNIFIED_INGEST_CAP env var to change limit
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
