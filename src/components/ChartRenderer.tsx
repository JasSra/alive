"use client";
import dynamic from "next/dynamic";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { ChartConfig } from "@/lib/types";
import { getEventCountsApi, getStatistics, getRangeEvents } from "@/lib/api";
import { rangeToFromTo } from "@/lib/time";

// Plotly needs dynamic import to avoid SSR issues
type PlotComponent = React.ComponentType<Record<string, unknown>>;
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false }) as unknown as PlotComponent;

interface ChartRendererProps {
  config: ChartConfig;
  range: string;
  onMaximize?: (cfg: ChartConfig) => void;
}

const ChartRenderer = memo(function ChartRenderer({ config, range, onMaximize }: ChartRendererProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  type DayPoint = Record<string, string | number>;
  type StatsShape = { perDay: DayPoint[] } | null;
  type CountPoint = Record<string, string | number>;
  type CountsShape = CountPoint[] | null;
  type RangeEvt = { timestamp: string; statusCode?: number; responseTimeMs?: number };
  const [data, setData] = useState<StatsShape | CountsShape>(null);
  const [rangeData, setRangeData] = useState<RangeEvt[] | null>(null);
  const [width, setWidth] = useState<number>(600);

  // fetch data when config or range changes
  useEffect(() => {
    const { from, to } = rangeToFromTo(range);
    (async () => {
      try {
        if (config.api.kind === "statistics") {
          const stats = await getStatistics({ from, to, userScope: config.api.userScope });
          setData(stats);
          setRangeData(null);
        } else if (config.api.kind === "counts") {
          const counts = await getEventCountsApi({ from, to, userScope: config.api.userScope, orderBy: "most", limit: 20 });
          setData(counts);
          setRangeData(null);
        } else if (config.api.kind === "range") {
          const rows = (await getRangeEvents({ from, to, userScope: config.api.userScope, limit: 5000 })) as RangeEvt[];
          setRangeData(rows);
          setData(null);
        }
      } catch (err) {
        console.error("Chart fetch error", err);
        setData(null);
        setRangeData(null);
      }
    })();
  }, [config, range]);

  const height = config.height ?? 220;

  // Resize observer for responsive Plotly sizing
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => setWidth(el.clientWidth));
    obs.observe(el);
    setWidth(el.clientWidth);
    return () => obs.disconnect();
  }, []);

  const plot = useMemo(() => {
    const baseLayout = {
      autosize: true,
      height,
      margin: { l: 36, r: 12, t: 10, b: 28 },
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: { size: 11 },
      xaxis: { automargin: true, tickfont: { size: 10 }, tickangle: 0, showgrid: false },
      yaxis: { automargin: true, tickfont: { size: 10 }, gridcolor: "rgba(127,127,127,0.2)", rangemode: "tozero" },
      showlegend: false,
      template: undefined as unknown as string,
    } as const;

    if (config.api.kind === "statistics" && data && (data as StatsShape)?.perDay) {
      const perDay = (data as StatsShape)!.perDay as DayPoint[];
      const s = config.series[0];
      return {
        data: [
          {
            type: "scatter",
            mode: "lines+markers",
            x: perDay.map((d) => String(d[config.xKey])),
            y: perDay.map((d) => Number(d[s.valueKey]) || 0),
            line: { color: s.color ?? "#6366f1", width: 2 },
            marker: { size: 4 },
            hovertemplate: "%{x}<br>%{y}<extra></extra>",
          },
        ],
  layout: baseLayout,
      };
    }

    if (config.api.kind === "counts" && Array.isArray(data)) {
      const s = config.series[0];
      const arr = data as CountPoint[];
      return {
        data: [
          {
            type: "bar",
            x: arr.map((d) => String(d[config.xKey])),
            y: arr.map((d) => Number(d[s.valueKey]) || 0),
            marker: { color: s.color ?? "#10b981" },
            hovertemplate: "%{x}<br>%{y}<extra></extra>",
          },
        ],
  layout: { ...baseLayout, xaxis: { ...baseLayout.xaxis, tickangle: -30 } },
      };
    }

    if (config.api.kind === "range" && Array.isArray(rangeData) && config.derived === "latency-histogram") {
      const latencies = (rangeData as RangeEvt[])
        .map((r) => r.responseTimeMs)
        .filter((v): v is number => typeof v === "number" && v >= 0);
      const bins = [...new Set((config.bins && config.bins.length ? config.bins : [100, 300, 700, 1500]).filter((b) => b > 0).sort((a, b) => a - b))];
      const edges = [0, ...bins, Infinity];
      const labels: string[] = [];
      const counts: number[] = new Array(edges.length - 1).fill(0);
      for (let i = 0; i < edges.length - 1; i += 1) {
        const lo = edges[i];
        const hi = edges[i + 1];
        labels.push(hi === Infinity ? `${lo}+ ms` : `${lo}-${hi} ms`);
      }
      for (const v of latencies) {
        const idx = edges.findIndex((lo, i) => v >= lo && v < edges[i + 1]);
        if (idx >= 0 && idx < counts.length) counts[idx] += 1;
      }
      return {
        data: [
          {
            type: "bar",
            x: labels,
            y: counts,
            marker: { color: config.series[0]?.color ?? "#06b6d4" },
            hovertemplate: "%{x}<br>%{y}<extra></extra>",
          },
        ],
  layout: { ...baseLayout, barmode: "overlay", xaxis: { ...baseLayout.xaxis, tickangle: -20 } },
      };
    }

    if (config.api.kind === "range" && Array.isArray(rangeData) && config.derived === "error-rate") {
      // Aggregate by day
      const map = new Map<string, { total: number; errors: number }>();
      for (const v of rangeData as RangeEvt[]) {
        const d = new Date(v.timestamp);
        const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
        const rec = map.get(key) ?? { total: 0, errors: 0 };
        rec.total += 1;
        if (typeof v.statusCode === "number" && v.statusCode >= 400) rec.errors += 1;
        map.set(key, rec);
      }
      const rows = [...map.entries()]
        .map(([date, agg]) => ({ date, pct: agg.total ? (agg.errors / agg.total) * 100 : 0 }))
        .sort((a, b) => (a.date < b.date ? -1 : 1));
      return {
        data: [
          {
            type: "scatter",
            mode: "lines+markers",
            x: rows.map((r) => r.date),
            y: rows.map((r) => r.pct),
            line: { color: config.series[0]?.color ?? "#ef4444", width: 2 },
            marker: { size: 4 },
            hovertemplate: "%{x}<br>%{y:.1f}%<extra></extra>",
          },
        ],
  layout: { ...baseLayout, yaxis: { ...baseLayout.yaxis, ticksuffix: "%", rangemode: "tozero" } },
      };
    }

    return { data: [], layout: baseLayout };
  }, [config, data, rangeData, height]);

  const modebar = useMemo(
    () => ({ displaylogo: false, modeBarButtonsToRemove: ["toImage", "zoomIn2d", "zoomOut2d", "autoScale2d", "lasso2d"] as string[] }),
    []
  );

  return (
    <div ref={containerRef} className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-3 bg-white dark:bg-neutral-900 shadow-sm">
      <div className="flex items-center justify-between mb-1">
        <div className="text-sm font-medium truncate" title={config.title}>{config.title}</div>
        {onMaximize && (
          <button
            aria-label="Maximize chart"
            className="text-xs px-2 py-1 rounded-md border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            onClick={() => onMaximize(config)}
          >
            Expand
          </button>
        )}
      </div>
      <Plot
        data={plot.data as unknown}
        layout={{ ...(plot.layout as Record<string, unknown>), width }}
        useResizeHandler={true}
        className="w-full"
        config={modebar as unknown}
        style={{ width: "100%", height }}
      />
    </div>
  );
});

export default ChartRenderer;
