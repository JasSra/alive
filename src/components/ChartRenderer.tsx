"use client";
import * as d3 from "d3";
import { memo, useEffect, useRef, useState } from "react";
import type { ChartConfig } from "@/lib/types";
import { getEventCountsApi, getStatistics, getRangeEvents } from "@/lib/api";
import { rangeToFromTo } from "@/lib/time";

interface ChartRendererProps {
  config: ChartConfig;
  range: string;
}

const ChartRenderer = memo(function ChartRenderer({ config, range }: ChartRendererProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  type DayPoint = Record<string, string | number>;
  type StatsShape = { perDay: DayPoint[] } | null;
  type CountPoint = Record<string, string | number>;
  type CountsShape = CountPoint[] | null;
  type RangeEvt = { timestamp: string; statusCode?: number; responseTimeMs?: number };
  const [data, setData] = useState<StatsShape | CountsShape>(null);
  const [rangeData, setRangeData] = useState<RangeEvt[] | null>(null);

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

  // render chart with D3
  useEffect(() => {
  const svg = d3.select(svgRef.current);
  svg.selectAll("*").remove();
  if (!data && !(config.api.kind === "range" && rangeData)) return;

    const width = svgRef.current?.clientWidth ?? 600;
    svg.attr("viewBox", `0 0 ${width} ${height}`);
    const margin = { top: 20, right: 16, bottom: 28, left: 36 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  if (config.api.kind === "statistics" && data && Array.isArray((data as StatsShape)!.perDay)) {
      const perDay = (data as StatsShape)!.perDay as DayPoint[];
      // Line chart over perDay
      const series = config.series[0];
      const x = d3
        .scaleBand()
        .domain(perDay.map((d) => String(d[config.xKey])))
        .range([0, innerW])
        .padding(0.1);
      const y = d3
        .scaleLinear()
        .domain([0, d3.max(perDay, (d) => Number(d[series.valueKey]) || 0) || 0])
        .nice()
        .range([innerH, 0]);

      // axis
      g.append("g").attr("transform", `translate(0,${innerH})`).call(d3.axisBottom(x).tickSizeOuter(0));
      g.append("g").call(d3.axisLeft(y).ticks(5));

      // line
      const line = d3
        .line<DayPoint>()
        .x((d) => (x(String(d[config.xKey])) ?? 0) + x.bandwidth() / 2)
        .y((d) => y(Number(d[series.valueKey]) || 0));
      g.append("path")
        .datum(perDay)
        .attr("fill", "none")
        .attr("stroke", series.color ?? "#6366f1")
        .attr("stroke-width", 2)
        .attr("d", line as unknown as string);
    }

    if (config.api.kind === "counts" && Array.isArray(data)) {
      // Bar chart of event counts
      const s = config.series[0];
      const x = d3
        .scaleBand()
        .domain((data as CountPoint[]).map((d) => String(d[config.xKey])))
        .range([0, innerW])
        .padding(0.1);
      const y = d3
        .scaleLinear()
        .domain([0, d3.max((data as CountPoint[]), (d) => Number(d[s.valueKey]) || 0) || 0])
        .nice()
        .range([innerH, 0]);

      g.append("g").attr("transform", `translate(0,${innerH})`).call(d3.axisBottom(x).tickSizeOuter(0));
      g.append("g").call(d3.axisLeft(y).ticks(5));

      g
        .append("g")
        .selectAll("rect")
        .data(data as CountPoint[])
        .join("rect")
        .attr("x", (d) => x(String(d[config.xKey])) ?? 0)
        .attr("y", (d) => y(Number(d[s.valueKey]) || 0))
        .attr("width", x.bandwidth())
        .attr("height", (d) => innerH - y(Number(d[s.valueKey]) || 0))
        .attr("fill", s.color ?? "#10b981");
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

      const x = d3.scaleBand().domain(labels).range([0, innerW]).padding(0.1);
      const y = d3.scaleLinear().domain([0, d3.max(counts) || 0]).nice().range([innerH, 0]);

      g.append("g").attr("transform", `translate(0,${innerH})`).call(d3.axisBottom(x).tickSizeOuter(0)).selectAll("text").style("font-size", "10px");
      g.append("g").call(d3.axisLeft(y).ticks(5));

      g
        .append("g")
        .selectAll("rect")
        .data(labels.map((lab, i) => ({ lab, v: counts[i] })))
        .join("rect")
        .attr("x", (d) => x(d.lab) ?? 0)
        .attr("y", (d) => y(d.v))
        .attr("width", x.bandwidth())
        .attr("height", (d) => innerH - y(d.v))
        .attr("fill", config.series[0]?.color ?? "#06b6d4");
    }

    if (config.api.kind === "range" && Array.isArray(rangeData) && config.derived === "error-rate") {
      const byDay = d3
        .rollups(
          rangeData as RangeEvt[],
          (vals) => {
            const total = vals.length;
            const errors = vals.filter((v) => typeof v.statusCode === "number" && v.statusCode >= 400).length;
            return { total, errors, pct: total ? (errors / total) * 100 : 0 };
          },
          (v) => {
            const d = new Date(v.timestamp);
            return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
          },
        )
        .map(([date, agg]) => ({ date, pct: agg.pct }))
        .sort((a, b) => (a.date < b.date ? -1 : 1));

      const x = d3.scaleBand().domain(byDay.map((d) => d.date)).range([0, innerW]).padding(0.1);
      const y = d3.scaleLinear().domain([0, d3.max(byDay, (d) => d.pct) || 0]).nice().range([innerH, 0]);

      g.append("g").attr("transform", `translate(0,${innerH})`).call(d3.axisBottom(x).tickSizeOuter(0));
      g.append("g").call(d3.axisLeft(y).ticks(5).tickFormat((v) => `${v}%` as unknown as string));

      const line = d3
        .line<{ date: string; pct: number }>()
        .x((d) => (x(d.date) ?? 0) + x.bandwidth() / 2)
        .y((d) => y(d.pct));
      g
        .append("path")
        .datum(byDay)
        .attr("fill", "none")
        .attr("stroke", config.series[0]?.color ?? "#ef4444")
        .attr("stroke-width", 2)
        .attr("d", line as unknown as string);
    }
  }, [data, config, height, rangeData]);

  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4 bg-white dark:bg-neutral-900">
      <div className="text-sm font-medium mb-2">{config.title}</div>
      <svg ref={svgRef} className="w-full" height={height} role="img" aria-label={config.title} />
    </div>
  );
});

export default ChartRenderer;
