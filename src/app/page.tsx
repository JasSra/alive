"use client";
import Header from "@/components/Header";
import Filters from "@/components/Filters";
import LiveEventTable from "@/components/LiveEventTable";
import Timeline from "@/components/Timeline";
// import ServiceFilter from "@/components/ServiceFilter";
import ServiceDashboard from "@/components/ServiceDashboard";
import ServiceBadges from "@/components/ServiceBadges";
// import type { ChartConfig } from "@/lib/types";
import { useEventStream } from "@/hooks/useEventStream";
import { useLiveFeed, type Transport } from "@/hooks/useLiveFeed";
import { rangeToFromTo } from "@/lib/time";
import { getRangeEvents } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";
// import { Dialog, DialogBackdrop, DialogPanel } from "@headlessui/react";
import { useCorrelation, type RangeEvt as RangeEvtType } from "@/hooks/useCorrelation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { 
  faDownload, 
  faTrash, 
  faBug, 
  faDatabase,
  faServer
} from "@fortawesome/free-solid-svg-icons";

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
  const [showInternal, setShowInternal] = useState(false);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [showServiceDashboard, setShowServiceDashboard] = useState(false);
  const [viewingMode, setViewingMode] = useState<'all' | 'requests' | 'responses' | 'events' | 'analytics'>('all');
  const [debugInfo, setDebugInfo] = useState<{
    totalEvents: number;
    lastFewEvents: Array<{
      id: string;
      name: string;
      timestamp: string;
      userId: string | null;
    }>;
    sseClients: number;
    wsClients: number;
  } | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  // Helper functions to determine what to show based on viewing mode
  const shouldShowEvents = () => viewingMode === 'all' || viewingMode === 'events';
  const shouldShowCorrelation = () => viewingMode === 'all' || viewingMode === 'requests' || viewingMode === 'responses';

  // Helper to identify internal tracking/monitoring events (ingested via our own endpoints)
  const isInternalEvent = (e: LiveEvt): boolean => {
    const d = e?.data;
    if (!d || typeof d !== 'object') return false;
    const dataObj = (d.data && typeof d.data === 'object') ? (d.data as Record<string, unknown>) : undefined;
    const payload = dataObj && 'payload' in dataObj ? (dataObj.payload as Record<string, unknown> | undefined) : undefined;
    const metadata = payload && typeof payload === 'object' ? (payload.metadata as Record<string, unknown> | undefined) : undefined;
    const reqPath = typeof metadata?.["requestPath"] === 'string' ? String(metadata?.["requestPath"]) : '';
    // Hide events that were tracked by our own ingestion endpoints
    if (reqPath.startsWith('/api/events/track') || reqPath.startsWith('/api/monitor')) return true;
    return false;
  };

  const liveEventsFiltered = useMemo(() => {
    if (!live) return [] as LiveEvt[];
    if (showInternal) return liveEvents as LiveEvt[];
    return (liveEvents as LiveEvt[]).filter((e) => !isInternalEvent(e));
  }, [live, liveEvents, showInternal]);

  const activeEvents = live ? liveEventsFiltered : manualEvents.map(e => ({
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
  const source: (LiveEvt | RangeEvt)[] = live ? (liveEventsFiltered as unknown as LiveEvt[]) : (manualEvents as RangeEvt[]);
  const list = source.map((e: LiveEvt | RangeEvt) => {
      if ("timestamp" in e) {
        const t = Date.parse(e.timestamp);
        const name = e.name;
        const color = e.statusCode ? (e.statusCode >= 400 ? "#ef4444" : "#10b981") : undefined;
        return { id: e.id, name, t, color, correlationId: e.correlationId };
      }
      const d = (e as LiveEvt).data;
      // Prefer METHOD path if present in payload.metadata for request/response
      let name = d?.data && typeof d.data === "object" && "name" in d.data ? String((d.data as { name?: string }).name ?? "event") : d?.type ?? "event";
      const t = (e as LiveEvt).t ?? Date.now();
      const payload = (d?.data && typeof d.data === "object" && "payload" in d.data ? (d.data as { payload?: { correlationId?: string; statusCode?: number; metadata?: Record<string, unknown> } }).payload : undefined) ?? undefined;
      const meta = payload?.metadata as Record<string, unknown> | undefined;
      const m = typeof meta?.["method"] === "string" ? String(meta?.["method"]) : undefined;
      const p = typeof meta?.["path"] === "string" ? String(meta?.["path"]) : (typeof meta?.["url"] === "string" ? String(meta?.["url"]) : undefined);
      if (p) name = `${m ? m.toUpperCase() + " " : ""}${p}`;
      const correlationId = payload?.correlationId;
      const statusCode = payload?.statusCode;
      const color = statusCode ? (statusCode >= 400 ? "#ef4444" : "#10b981") : undefined;
      return { id: String((e as LiveEvt).id ?? `${name}-${t}`), name, t, color, correlationId };
    });
    setTimelineItems(list.reverse());
  }, [live, liveEventsFiltered, manualEvents]);

  const fetchRange = async () => {
    // Don't fetch if we're in analytics-only mode
    if (viewingMode === 'analytics') {
      console.log("Skipping range fetch - analytics mode only");
      return;
    }
    
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

  const fetchDebugInfo = async () => {
    try {
      const response = await fetch('/api/events/debug');
      const data = await response.json();
      setDebugInfo(data);
      setShowDebug(true);
      console.log("Debug info:", data);
    } catch (error) {
      console.error("Failed to fetch debug info:", error);
    }
  };

  // Auto-refresh for T-pattern time windows to create "moving data" effect
  // Only use auto-refresh for SSE transport or when not in live mode
  // WebSocket provides real-time data, so no need for polling
  useEffect(() => {
    // Skip auto-refresh if:
    // 1. Not in live mode, OR
    // 2. Using WebSocket transport (real-time data), OR
    // 3. In analytics-only mode (no need for event data)
    if (!live || transport === "ws" || viewingMode === 'analytics') return;
    
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
  }, [range, live, transport, viewingMode]);

  const liveForCorr = useMemo(() => (liveEvents as LiveEvt[]).map((e) => ({ data: e.data, t: e.t })), [liveEvents]);
  const correlated = useCorrelation(liveForCorr, manualEvents as RangeEvtType[], live);
  const [sortKey, setSortKey] = useState<'name' | 'correlationId' | 'requestAt' | 'responseAt' | 'statusCode' | 'latencyMs'>('responseAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const filteredCorrelated = useMemo(() => {
    const is2xx = (s?: number) => typeof s === "number" && s >= 200 && s < 300;
    const is4xx = (s?: number) => typeof s === "number" && s >= 400 && s < 500;
    const is5xx = (s?: number) => typeof s === "number" && s >= 500;
    const base = correlated.filter((c) => {
      if (filterName && !c.name.toLowerCase().includes(filterName.toLowerCase())) return false;
      if (filterCorr && (c.correlationId ?? "").indexOf(filterCorr) === -1) return false;
      if (filterStatus === "pending" && !c.pending) return false;
      if (filterStatus === "2xx" && !is2xx(c.statusCode)) return false;
      if (filterStatus === "4xx" && !is4xx(c.statusCode)) return false;
      if (filterStatus === "5xx" && !is5xx(c.statusCode)) return false;
      return true;
    });
    const getVal = (obj: typeof correlated[number]) => {
      switch (sortKey) {
        case 'name': return obj.name ?? '';
        case 'correlationId': return obj.correlationId ?? '';
        case 'requestAt': return obj.requestAt ?? 0;
        case 'responseAt': return obj.responseAt ?? 0;
        case 'statusCode': return obj.statusCode ?? 0;
        case 'latencyMs': return obj.latencyMs ?? 0;
      }
    };
    return base.sort((a, b) => {
      const av = getVal(a);
      const bv = getVal(b);
      if (av === bv) return 0;
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === 'asc' ? ((av as number) - (bv as number)) : ((bv as number) - (av as number));
    });
  }, [correlated, filterName, filterCorr, filterStatus, sortKey, sortDir]);

  // Analytics maximize modal removed
  return (
    <div className="min-h-screen w-full flex flex-col bg-background text-foreground">
      <Header />
      <main className="flex-1 w-full grid grid-cols-12 gap-3 p-3 md:p-6 min-h-0 auto-rows-max">
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
            <label className="text-xs text-neutral-400">Mode</label>
            <select 
              aria-label="Viewing Mode" 
              value={viewingMode} 
              onChange={(e) => setViewingMode(e.target.value as typeof viewingMode)} 
              className="text-sm px-2 py-1 rounded-md border border-neutral-700 bg-neutral-900 text-white"
            >
              <option value="all">All Data</option>
              <option value="requests">Requests Only</option>
              <option value="responses">Responses Only</option>
              <option value="events">Events Only</option>
              <option value="analytics">Analytics Only</option>
            </select>
            <label className="text-xs text-neutral-400" title="Include events generated by our own ingestion endpoints (/api/events/track, /api/monitor)">Internal</label>
            <button 
              onClick={() => setShowInternal((v) => !v)} 
              className={`text-sm px-2 py-1 rounded-md border ${showInternal ? "bg-purple-500/20 border-purple-400 text-purple-200" : "border-neutral-700"}`}
              title={showInternal ? 'Showing internal ingestion events' : 'Hiding internal ingestion events'}
            >
              {showInternal ? 'On' : 'Off'}
            </button>
            <label className="text-xs text-neutral-400">Live</label>
            <button onClick={() => setLive((v) => !v)} className={`text-sm px-2 py-1 rounded-md border ${live ? "bg-emerald-500/20 border-emerald-400 text-emerald-200" : "border-neutral-700"}`}>{live ? "On" : "Off"}</button>
            <label className="text-xs text-neutral-400">Transport</label>
            <select aria-label="Transport" value={transport} onChange={(e) => setTransport(e.target.value as Transport)} className="text-sm px-2 py-1 rounded-md border border-neutral-700 bg-neutral-900 text-white">
              <option value="sse">SSE</option>
              <option value="ws">WebSocket</option>
            </select>
            <span className={`text-xs px-2 py-1 rounded ${status === "open" ? "bg-emerald-500/20 text-emerald-200" : status === "connecting" ? "bg-amber-500/20 text-amber-200" : status === "error" ? "bg-rose-500/20 text-rose-200" : "bg-neutral-800 text-neutral-400"}`}>{status}</span>
            <button 
              onClick={fetchRange} 
              disabled={viewingMode === 'analytics'}
              className={`text-sm px-3 py-2 rounded-md border border-neutral-700 inline-flex items-center gap-2 ${
                viewingMode === 'analytics' 
                  ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed' 
                  : 'bg-neutral-900 hover:bg-neutral-800'
              }`} 
              aria-label="Fetch range"
              title={viewingMode === 'analytics' ? 'Disabled in Analytics mode' : 'Fetch historical event data'}
            >
              <FontAwesomeIcon icon={faDownload} className="text-blue-400" />
              Fetch Range
            </button>
            <button 
              onClick={async () => { 
                try { await fetch('/api/events/clear', { method: 'POST' }); } catch {}
                clearSse();
                clearLive();
              }} 
              disabled={viewingMode === 'analytics'}
              className={`text-sm px-3 py-2 rounded-md border border-neutral-700 inline-flex items-center gap-2 ${
                viewingMode === 'analytics' 
                  ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed' 
                  : 'bg-neutral-900 hover:bg-neutral-800'
              }`} 
              aria-label="Clear events"
              title={viewingMode === 'analytics' ? 'Disabled in Analytics mode' : 'Clear all events'}
            >
              <FontAwesomeIcon icon={faTrash} className="text-red-400" />
              Clear
            </button>
            <button onClick={fetchDebugInfo} className="text-sm px-3 py-2 rounded-md border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 inline-flex items-center gap-2" aria-label="Debug info">
              <FontAwesomeIcon icon={faBug} className="text-yellow-400" />
              Debug
            </button>
          </div>
        </div>

        {/* Stats cards */}
        <section className="col-span-12 grid grid-cols-6 gap-2 mb-1">
          <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-3">
            <div className="text-xs text-neutral-400 mb-1 flex items-center gap-1">
              <FontAwesomeIcon icon={faDatabase} className="text-blue-400" />
              Events (session)
            </div>
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
            <div className="text-xs text-neutral-400 mb-1 flex items-center gap-1">
              <FontAwesomeIcon icon={faServer} className="text-blue-400" />
              Service Filter
            </div>
            <button 
              onClick={() => setShowServiceDashboard(!showServiceDashboard)}
              className={`text-sm font-bold ${showServiceDashboard ? "text-blue-400" : "text-blue-300"} hover:text-blue-200`}
            >
              {selectedServices.length > 0 ? `${selectedServices.length} Services` : "All Services"}
            </button>
          </div>
        </section>

        {/* Service Dashboard */}
        {showServiceDashboard && (
          <section className="col-span-12 mb-4">
            <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-4">
              <div className="flex items-center gap-2 mb-4">
                <FontAwesomeIcon icon={faServer} className="text-blue-400" />
                <h3 className="text-lg font-bold text-white">Service Selection</h3>
              </div>
              
              <ServiceBadges
                selectedServices={selectedServices}
                onServicesChange={setSelectedServices}
                timeRange={{ from: rangeToFromTo(range).from, to: rangeToFromTo(range).to }}
                maxVisible={8}
              />
              
              {/* Service Statistics - only show if services are selected */}
              {selectedServices.length > 0 && (
                <div className="mt-6">
                  <ServiceDashboard
                    selectedServices={selectedServices}
                    timeRange={{ from: rangeToFromTo(range).from, to: rangeToFromTo(range).to }}
                    transport={transport}
                    live={live}
                  />
                </div>
              )}
            </div>
          </section>
        )}

        {/* Debug Info */}
        {showDebug && debugInfo && (
          <section className="col-span-12 mb-4">
            <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-4">
              <div className="flex items-center gap-2 mb-3">
                <FontAwesomeIcon icon={faBug} className="text-yellow-400" />
                <h3 className="text-lg font-bold text-yellow-400">Debug Information</h3>
                <button onClick={() => setShowDebug(false)} className="ml-auto text-xs text-gray-400 hover:text-white">×</button>
              </div>
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-neutral-400">Total Events in Store:</div>
                  <div className="text-white font-bold">{debugInfo.totalEvents}</div>
                </div>
                <div>
                  <div className="text-neutral-400">SSE Clients:</div>
                  <div className="text-white font-bold">{debugInfo.sseClients}</div>
                </div>
                <div>
                  <div className="text-neutral-400">WS Clients:</div>
                  <div className="text-white font-bold">{debugInfo.wsClients}</div>
                </div>
                <div>
                  <div className="text-neutral-400">Live Events in UI:</div>
                  <div className="text-white font-bold">{liveEvents.length}</div>
                </div>
              </div>
              {debugInfo.lastFewEvents.length > 0 && (
                <div className="mt-4">
                  <div className="text-neutral-400 mb-2">Last Few Events:</div>
                  <div className="bg-neutral-800 rounded p-2 text-xs font-mono overflow-auto max-h-32">
                    <pre>{JSON.stringify(debugInfo.lastFewEvents, null, 2)}</pre>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

  {/* Interactive Timeline - Top */}
        {shouldShowEvents() && (
          <section aria-label="Interactive Timeline" className="col-span-12">
            <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-3">
              <div className="text-sm font-bold mb-3 text-emerald-400 flex items-center gap-2">
                <span aria-hidden className="fa-solid fa-chart-gantt" />
                Live Event Timeline
                <span className="text-xs text-neutral-400 ml-2">({timelineItems.length} events)</span>
                {viewingMode === 'events' && <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded ml-2">Events Mode</span>}
              </div>
              <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-2">
                <Timeline items={timelineItems} />
              </div>
            </div>
          </section>
        )}

        {/* Live Events Stream - Row 3 */}
        {shouldShowEvents() && (
          <section aria-label="Live Events" className="col-span-12">
            <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-3">
              <div className="text-sm font-bold mb-3 text-amber-400 flex items-center gap-2">
                <span aria-hidden className="fa-solid fa-table-list" />
                Live Events Stream
                <span className="text-xs text-neutral-400 ml-2">({activeEvents.length} events)</span>
                {viewingMode === 'events' && <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-1 rounded ml-2">Events Mode</span>}
              </div>
              <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] max-h-64 overflow-auto">
                <LiveEventTable events={activeEvents as LiveEvt[]} viewingMode={viewingMode} />
              </div>
            </div>
          </section>
        )}

        {/* Request/Response Correlation - Row 4 */}
        {shouldShowCorrelation() && (
          <section aria-label="Correlation Analysis" className="col-span-12">
            <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-3">
              <div className="text-sm font-bold mb-3 text-cyan-400 flex items-center gap-2">
                <span aria-hidden className="fa-solid fa-link" />
                {viewingMode === 'requests' ? 'Request Analysis' : 
                 viewingMode === 'responses' ? 'Response Analysis' : 
                 'Request/Response Correlation Analysis'}
                <span className="text-xs text-neutral-400 ml-2">({filteredCorrelated.length} correlations)</span>
                {viewingMode === 'requests' && <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded ml-2">Requests Mode</span>}
                {viewingMode === 'responses' && <span className="text-xs bg-green-500/20 text-green-300 px-2 py-1 rounded ml-2">Responses Mode</span>}
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
            <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] max-h-64 overflow-auto">
              <table className="w-full text-xs">
                <thead className="bg-neutral-800 text-neutral-300 sticky top-0">
                  <tr>
                    <th className="text-left p-2 font-semibold cursor-pointer" onClick={() => setSortKey(k => { setSortDir(d => (k === 'name' ? (d === 'asc' ? 'desc' : 'asc') : 'desc')); return 'name'; })}>
                      Event {sortKey === 'name' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th className="text-left p-2 font-semibold cursor-pointer" onClick={() => setSortKey(k => { setSortDir(d => (k === 'correlationId' ? (d === 'asc' ? 'desc' : 'asc') : 'desc')); return 'correlationId'; })}>
                      Correlation {sortKey === 'correlationId' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    {(viewingMode === 'all' || viewingMode === 'requests') && (
                      <th className="text-left p-2 font-semibold cursor-pointer" onClick={() => setSortKey(k => { setSortDir(d => (k === 'requestAt' ? (d === 'asc' ? 'desc' : 'asc') : 'desc')); return 'requestAt'; })}>
                        Request {sortKey === 'requestAt' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                      </th>
                    )}
                    {(viewingMode === 'all' || viewingMode === 'responses') && (
                      <th className="text-left p-2 font-semibold cursor-pointer" onClick={() => setSortKey(k => { setSortDir(d => (k === 'responseAt' ? (d === 'asc' ? 'desc' : 'asc') : 'desc')); return 'responseAt'; })}>
                        Response {sortKey === 'responseAt' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                      </th>
                    )}
                    {(viewingMode === 'all' || viewingMode === 'responses') && (
                      <th className="text-left p-2 font-semibold cursor-pointer" onClick={() => setSortKey(k => { setSortDir(d => (k === 'statusCode' ? (d === 'asc' ? 'desc' : 'asc') : 'desc')); return 'statusCode'; })}>
                        Status {sortKey === 'statusCode' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                      </th>
                    )}
                    {(viewingMode === 'all' || viewingMode === 'responses') && (
                      <th className="text-left p-2 font-semibold cursor-pointer" onClick={() => setSortKey(k => { setSortDir(d => (k === 'latencyMs' ? (d === 'asc' ? 'desc' : 'asc') : 'desc')); return 'latencyMs'; })}>
                        Latency {sortKey === 'latencyMs' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredCorrelated.map((c) => (
                    <tr key={c.id} className="border-t border-neutral-800 hover:bg-neutral-900/50 transition-colors">
                      <td className="p-2 font-mono text-white">{c.name}</td>
                      <td className="p-2 font-mono text-cyan-300 break-all">{c.correlationId ?? "—"}</td>
                      {(viewingMode === 'all' || viewingMode === 'requests') && (
                        <td className="p-2 font-mono text-emerald-300">{c.requestAt ? new Date(c.requestAt).toISOString().split("T")[1].replace("Z", "") : "—"}</td>
                      )}
                      {(viewingMode === 'all' || viewingMode === 'responses') && (
                        <td className="p-2 font-mono">{c.responseAt ? new Date(c.responseAt).toISOString().split("T")[1].replace("Z", "") : c.pending ? <span className="text-amber-300 animate-pulse">pending</span> : "—"}</td>
                      )}
                      {(viewingMode === 'all' || viewingMode === 'responses') && (
                        <td className="p-2">
                          {typeof c.statusCode === "number" ? (
                            <span className={`px-2 py-1 rounded font-bold ${c.statusCode >= 500 ? "bg-rose-500/30 text-rose-100 border border-rose-500/50" : c.statusCode >= 400 ? "bg-amber-500/30 text-amber-100 border border-amber-500/50" : "bg-emerald-500/30 text-emerald-100 border border-emerald-500/50"}`}>{c.statusCode}</span>
                          ) : "—"}
                        </td>
                      )}
                      {(viewingMode === 'all' || viewingMode === 'responses') && (
                        <td className="p-2 font-mono">{typeof c.latencyMs === "number" ? <span className={c.latencyMs > 1000 ? "text-rose-300" : c.latencyMs > 500 ? "text-amber-300" : "text-emerald-300"}>{c.latencyMs} ms</span> : "—"}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
        )}

  {/* Removed Chart Configuration panel for a cleaner UI */}
      </main>
  {/* Analytics maximize modal removed */}
    </div>
  );
}

