"use client";
import Header from "@/components/Header";
import Filters from "@/components/Filters";
import LiveEventTable from "@/components/LiveEventTable";
import ChartRenderer from "@/components/ChartRenderer";
import Timeline from "@/components/Timeline";
import type { ChartConfig } from "@/lib/types";
import { useEventStream } from "@/hooks/useEventStream";
import { useLiveFeed, type Transport } from "@/hooks/useLiveFeed";
import { rangeToFromTo } from "@/lib/time";
import { getRangeEvents } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";
import { useCorrelation, type RangeEvt as RangeEvtType } from "@/hooks/useCorrelation";

type LiveSSEData = { type?: string; data?: { name?: string; timestamp?: string; payload?: { correlationId?: string; statusCode?: number } } | Record<string, unknown> };
export type LiveEvt = { id?: string; t?: number; data?: LiveSSEData };
type RangeEvt = { id: string; name: string; timestamp: string; correlationId?: string; statusCode?: number; responseTimeMs?: number };

export default function Page() {
  // ...existing code...
  // Layout: full desktop grid, dense, high-contrast, responsive
  // ...existing code...
  const [range, setRange] = useState("5m");
  const { clear: clearSse } = useEventStream(500);
  const [live, setLive] = useState(true);
  const [transport, setTransport] = useState<Transport>("sse");
  const { events: liveEvents, clear: clearLive, status } = useLiveFeed<LiveSSEData>(live, transport, 500);
  const [timelineItems, setTimelineItems] = useState<{ id: string; name: string; t: number; color?: string; correlationId?: string }[]>([]);
  const [manualEvents, setManualEvents] = useState<RangeEvt[]>([]);
  const [filterName, setFilterName] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCorr, setFilterCorr] = useState("");
  const [configText, setConfigText] = useState<string>(
    JSON.stringify(
      [
        {
          id: "per-day",
          title: "Events per day",
          type: "line",
          api: { kind: "statistics", userScope: "all" },
          xKey: "date",
          series: [{ label: "Count", valueKey: "count", color: "#6366f1" }],
          height: 200,
        },
        {
          id: "top-events",
          title: "Top events",
          type: "bar",
          api: { kind: "counts", userScope: "all" },
          xKey: "eventName",
          series: [{ label: "Count", valueKey: "count", color: "#10b981" }],
          height: 200,
        },
        {
          id: "latency-hist",
          title: "Latency distribution",
          type: "bar",
          api: { kind: "range", userScope: "all" },
          xKey: "bin",
          series: [{ label: "Requests", valueKey: "count", color: "#06b6d4" }],
          height: 200,
          derived: "latency-histogram",
          bins: [50, 150, 300, 700, 1500]
        },
        {
          id: "error-rate",
          title: "Error rate (%)",
          type: "line",
          api: { kind: "range", userScope: "all" },
          xKey: "date",
          series: [{ label: "% Errors", valueKey: "pct", color: "#ef4444" }],
          height: 200,
          derived: "error-rate"
        },
        {
          id: "status-breakdown",
          title: "Status code breakdown",
          type: "bar",
          api: { kind: "counts", userScope: "all" },
          xKey: "eventName",
          series: [{ label: "Events", valueKey: "count", color: "#f59e0b" }],
          height: 200,
        },
        {
          id: "throughput",
          title: "Request throughput",
          type: "line",
          api: { kind: "statistics", userScope: "all" },
          xKey: "date",
          series: [{ label: "Requests/day", valueKey: "count", color: "#8b5cf6" }],
          height: 200,
        }
      ] satisfies ChartConfig[],
      null,
      2,
    ),
  );
  const [parsedConfigs, setParsedConfigs] = useState<ChartConfig[]>([]);

  // parse JSON configs safely
  useEffect(() => {
    try {
      const obj = JSON.parse(configText) as ChartConfig[];
      if (Array.isArray(obj)) setParsedConfigs(obj);
    } catch {
      // ignore parse errors, keep last good
    }
  }, [configText]);

  const activeEvents = live ? liveEvents : manualEvents.map(e => ({
    id: e.id,
    t: Date.parse(e.timestamp),
    data: {
      type: 'event',
      data: {
        name: e.name,
        payload: {
          correlationId: e.correlationId,
          statusCode: e.statusCode,
          responseTimeMs: e.responseTimeMs
        }
      }
    }
  }));
  const counts = useMemo(() => ({
    total: live ? activeEvents.length : manualEvents.length,
    lastEvent: activeEvents[0]?.t ? new Date(activeEvents[0].t).toLocaleTimeString() : "—",
  }), [activeEvents, live, manualEvents.length]);

  // Build timeline points from live/manual events
  useEffect(() => {
  const source: (LiveEvt | RangeEvt)[] = live ? (liveEvents as unknown as LiveEvt[]) : (manualEvents as RangeEvt[]);
  const list = source.map((e: LiveEvt | RangeEvt) => {
      if ("timestamp" in e) {
        const t = Date.parse(e.timestamp);
        const name = e.name;
        const color = e.statusCode ? (e.statusCode >= 400 ? "#ef4444" : "#10b981") : undefined;
        return { id: e.id, name, t, color, correlationId: e.correlationId };
      }
      const d = (e as LiveEvt).data;
      const name = d?.data && typeof d.data === "object" && "name" in d.data ? String((d.data as { name?: string }).name ?? "event") : d?.type ?? "event";
      const t = (e as LiveEvt).t ?? Date.now();
      const payload = (d?.data && typeof d.data === "object" && "payload" in d.data ? (d.data as { payload?: { correlationId?: string; statusCode?: number } }).payload : undefined) ?? undefined;
      const correlationId = payload?.correlationId;
      const statusCode = payload?.statusCode;
      const color = statusCode ? (statusCode >= 400 ? "#ef4444" : "#10b981") : undefined;
      return { id: String((e as LiveEvt).id ?? `${name}-${t}`), name, t, color, correlationId };
    });
    setTimelineItems(list.reverse());
  }, [live, liveEvents, manualEvents]);

  const fetchRange = async () => {
    const { from, to } = rangeToFromTo(range);
    try {
      console.log("Fetching range data:", { from, to, range });
      const data = (await getRangeEvents({ from, to, userScope: "all", limit: 2000 })) as RangeEvt[];
      console.log("Fetched range data:", data.length, "events");
      setManualEvents(data);
      // Turn off live mode when manually fetching data
      setLive(false);
    } catch (error) {
      console.error("Failed to fetch range data:", error);
      setManualEvents([]);
    }
  };

  // Auto-refresh for T-pattern time windows to create "moving data" effect
  useEffect(() => {
    if (!live) return; // Only auto-refresh when in live mode
    
    const getRefreshInterval = (range: string) => {
      switch (range) {
        case "5m": return 5000;   // Refresh every 5 seconds for T-5M
        case "20m": return 15000; // Refresh every 15 seconds for T-20M  
        case "1h": return 30000;  // Refresh every 30 seconds for T-1H
        case "6h": return 120000; // Refresh every 2 minutes for T-6H
        default: return 60000;    // Default 1 minute for longer ranges
      }
    };
    
    const interval = getRefreshInterval(range);
    const timer = setInterval(() => {
      // Silently refresh the time range to create moving window effect
      const { from, to } = rangeToFromTo(range);
      getRangeEvents({ from, to, userScope: "all", limit: 2000 })
        .then((data) => {
          setManualEvents(data as RangeEvt[]);
        })
        .catch((error) => {
          console.error("Auto-refresh failed:", error);
        });
    }, interval);
    
    return () => clearInterval(timer);
  }, [range, live]);

  const liveForCorr = useMemo(() => (liveEvents as LiveEvt[]).map((e) => ({ data: e.data, t: e.t })), [liveEvents]);
  const correlated = useCorrelation(liveForCorr, manualEvents as RangeEvtType[], live);
  const filteredCorrelated = useMemo(() => {
    const is2xx = (s?: number) => typeof s === "number" && s >= 200 && s < 300;
    const is4xx = (s?: number) => typeof s === "number" && s >= 400 && s < 500;
    const is5xx = (s?: number) => typeof s === "number" && s >= 500;
    return correlated.filter((c) => {
      if (filterName && !c.name.toLowerCase().includes(filterName.toLowerCase())) return false;
      if (filterCorr && (c.correlationId ?? "").indexOf(filterCorr) === -1) return false;
      if (filterStatus === "pending" && !c.pending) return false;
      if (filterStatus === "2xx" && !is2xx(c.statusCode)) return false;
      if (filterStatus === "4xx" && !is4xx(c.statusCode)) return false;
      if (filterStatus === "5xx" && !is5xx(c.statusCode)) return false;
      return true;
    });
  }, [correlated, filterName, filterCorr, filterStatus]);

  return (
    <div className="min-h-screen w-full flex flex-col bg-black text-white">
      <Header />
      <main className="flex-1 w-full grid grid-cols-12 gap-2 p-2 md:p-4 min-h-0 auto-rows-max">
        {/* Top bar: controls and stats */}
        <div className="col-span-12 flex flex-wrap items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold flex items-center gap-2 tracking-tight">
              <span aria-hidden className="fa-solid fa-bolt text-amber-400" />
              Live Events
            </h1>
            <Filters range={range} onRangeChange={setRange} />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-neutral-400">Live</label>
            <button onClick={() => setLive((v) => !v)} className={`text-sm px-2 py-1 rounded-md border ${live ? "bg-emerald-500/20 border-emerald-400 text-emerald-200" : "border-neutral-700"}`}>{live ? "On" : "Off"}</button>
            <label className="text-xs text-neutral-400">Transport</label>
            <select aria-label="Transport" value={transport} onChange={(e) => setTransport(e.target.value as Transport)} className="text-sm px-2 py-1 rounded-md border border-neutral-700 bg-neutral-900 text-white">
              <option value="sse">SSE</option>
              <option value="ws">WebSocket</option>
            </select>
            <span className={`text-xs px-2 py-1 rounded ${status === "open" ? "bg-emerald-500/20 text-emerald-200" : status === "connecting" ? "bg-amber-500/20 text-amber-200" : status === "error" ? "bg-rose-500/20 text-rose-200" : "bg-neutral-800 text-neutral-400"}`}>{status}</span>
            <button onClick={fetchRange} className="text-sm px-3 py-2 rounded-md border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 inline-flex items-center gap-2" aria-label="Fetch range">
              <span aria-hidden className="fa-solid fa-cloud-arrow-down" />
              Fetch range
            </button>
            <button onClick={() => { clearSse(); clearLive(); }} className="text-sm px-3 py-2 rounded-md border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 inline-flex items-center gap-2" aria-label="Clear events">
              <span aria-hidden className="fa-regular fa-trash-can" />
              Clear
            </button>
          </div>
        </div>

        {/* Stats cards */}
        <section className="col-span-12 grid grid-cols-6 gap-2 mb-1">
          <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-3">
            <div className="text-xs text-neutral-400 mb-1">Events (session)</div>
            <div className="text-xl font-bold text-amber-400">{counts.total}</div>
          </div>
          <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-3">
            <div className="text-xs text-neutral-400 mb-1">Last event</div>
            <div className="text-sm font-mono text-emerald-400">{counts.lastEvent}</div>
          </div>
          <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-3">
            <div className="text-xs text-neutral-400 mb-1">Range</div>
            <div className="text-lg font-bold text-cyan-400">{range}</div>
          </div>
          <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-3">
            <div className="text-xs text-neutral-400 mb-1">Connection</div>
            <div className={`text-sm font-bold ${status === "open" ? "text-emerald-400" : status === "connecting" ? "text-amber-400" : "text-rose-400"}`}>
              {status.toUpperCase()}
            </div>
          </div>
          <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-3">
            <div className="text-xs text-neutral-400 mb-1">Correlations</div>
            <div className="text-xl font-bold text-purple-400">{filteredCorrelated.length}</div>
          </div>
          <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-3">
            <div className="text-xs text-neutral-400 mb-1">Transport</div>
            <div className="text-sm font-bold text-blue-400">{transport.toUpperCase()}</div>
          </div>
        </section>

        {/* Compact Charts Grid - Row 1 */}
        <section aria-label="Analytics Charts" className="col-span-12">
          <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-3">
            <div className="text-sm font-bold mb-3 text-purple-400 flex items-center gap-2">
              <span aria-hidden className="fa-solid fa-chart-line" />
              Analytics Dashboard
            </div>
            <div className="grid grid-cols-6 gap-2">
              {parsedConfigs.map((cfg) => (
                <div key={cfg.id} className="bg-neutral-950 rounded border border-neutral-700 p-2">
                  <ChartRenderer config={{...cfg, height: 120}} range={range} />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Interactive Timeline - Row 2 */}
        <section aria-label="Interactive Timeline" className="col-span-12">
          <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-3">
            <div className="text-sm font-bold mb-3 text-emerald-400 flex items-center gap-2">
              <span aria-hidden className="fa-solid fa-chart-gantt" />
              Live Event Timeline
              <span className="text-xs text-neutral-400 ml-2">({timelineItems.length} events)</span>
            </div>
            <div className="bg-neutral-950 rounded border border-neutral-700 p-2">
              <Timeline items={timelineItems} />
            </div>
          </div>
        </section>

        {/* Live Events Stream - Row 3 */}
        <section aria-label="Live Events" className="col-span-12">
          <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-3">
            <div className="text-sm font-bold mb-3 text-amber-400 flex items-center gap-2">
              <span aria-hidden className="fa-solid fa-table-list" />
              Live Events Stream
              <span className="text-xs text-neutral-400 ml-2">({activeEvents.length} events)</span>
            </div>
            <div className="bg-neutral-950 rounded border border-neutral-700 max-h-64 overflow-auto">
              <LiveEventTable events={activeEvents as LiveEvt[]} />
            </div>
          </div>
        </section>

        {/* Request/Response Correlation - Row 4 */}
        <section aria-label="Correlation Analysis" className="col-span-12">
          <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-3">
            <div className="text-sm font-bold mb-3 text-cyan-400 flex items-center gap-2">
              <span aria-hidden className="fa-solid fa-link" />
              Request/Response Correlation Analysis
              <span className="text-xs text-neutral-400 ml-2">({filteredCorrelated.length} correlations)</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs mb-3">
              <input 
                value={filterName} 
                onChange={(e) => setFilterName(e.target.value)} 
                placeholder="Filter by name" 
                className="px-2 py-1 rounded border border-neutral-700 bg-neutral-800 text-white placeholder-neutral-500 focus:border-cyan-500 focus:outline-none" 
              />
              <input 
                value={filterCorr} 
                onChange={(e) => setFilterCorr(e.target.value)} 
                placeholder="Filter by correlationId" 
                className="px-2 py-1 rounded border border-neutral-700 bg-neutral-800 text-white placeholder-neutral-500 focus:border-cyan-500 focus:outline-none" 
              />
              <select 
                aria-label="Status filter" 
                value={filterStatus} 
                onChange={(e) => setFilterStatus(e.target.value)} 
                className="px-2 py-1 rounded border border-neutral-700 bg-neutral-800 text-white focus:border-cyan-500 focus:outline-none"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="2xx">2xx Success</option>
                <option value="4xx">4xx Client Error</option>
                <option value="5xx">5xx Server Error</option>
              </select>
            </div>
            <div className="bg-neutral-950 rounded border border-neutral-700 max-h-64 overflow-auto">
              <table className="w-full text-xs">
                <thead className="bg-neutral-800 text-neutral-300 sticky top-0">
                  <tr>
                    <th className="text-left p-2 font-semibold">Event</th>
                    <th className="text-left p-2 font-semibold">Correlation</th>
                    <th className="text-left p-2 font-semibold">Request</th>
                    <th className="text-left p-2 font-semibold">Response</th>
                    <th className="text-left p-2 font-semibold">Status</th>
                    <th className="text-left p-2 font-semibold">Latency</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCorrelated.map((c) => (
                    <tr key={c.id} className="border-t border-neutral-800 hover:bg-neutral-900/50 transition-colors">
                      <td className="p-2 font-mono text-white">{c.name}</td>
                      <td className="p-2 font-mono text-cyan-300 break-all">{c.correlationId ?? "—"}</td>
                      <td className="p-2 font-mono text-emerald-300">{c.requestAt ? new Date(c.requestAt).toISOString().split("T")[1].replace("Z", "") : "—"}</td>
                      <td className="p-2 font-mono">{c.responseAt ? new Date(c.responseAt).toISOString().split("T")[1].replace("Z", "") : c.pending ? <span className="text-amber-300 animate-pulse">pending</span> : "—"}</td>
                      <td className="p-2">
                        {typeof c.statusCode === "number" ? (
                          <span className={`px-2 py-1 rounded font-bold ${c.statusCode >= 500 ? "bg-rose-500/30 text-rose-100 border border-rose-500/50" : c.statusCode >= 400 ? "bg-amber-500/30 text-amber-100 border border-amber-500/50" : "bg-emerald-500/30 text-emerald-100 border border-emerald-500/50"}`}>{c.statusCode}</span>
                        ) : "—"}
                      </td>
                      <td className="p-2 font-mono">{typeof c.latencyMs === "number" ? <span className={c.latencyMs > 1000 ? "text-rose-300" : c.latencyMs > 500 ? "text-amber-300" : "text-emerald-300"}>{c.latencyMs} ms</span> : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Chart Configuration - Row 5 (Collapsible) */}
        <section aria-label="Configuration" className="col-span-12">
          <details className="bg-neutral-900 rounded-lg border border-neutral-800">
            <summary className="p-3 cursor-pointer hover:bg-neutral-800/50 transition-colors">
              <span className="text-sm font-bold text-neutral-400 flex items-center gap-2">
                <span aria-hidden className="fa-solid fa-cog" />
                Chart Configuration (JSON)
                <span className="text-xs ml-2">Click to expand</span>
              </span>
            </summary>
            <div className="p-3 pt-0">
              <textarea
                id="chart-config"
                className="w-full h-32 font-mono text-xs rounded-md border border-neutral-700 bg-neutral-950 text-white p-2 focus:border-amber-500 focus:outline-none"
                value={configText}
                onChange={(e) => setConfigText(e.target.value)}
                placeholder="Edit chart configuration JSON here..."
              />
            </div>
          </details>
        </section>
      </main>
    </div>
  );
}

