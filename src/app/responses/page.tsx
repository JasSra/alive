"use client";
import Header from "@/components/Header";
import ControlsBar from "@/components/ControlsBar";
import { useEventStream } from "@/hooks/useEventStream";
import { useLiveFeed } from "@/hooks/useLiveFeed";
import { rangeToFromTo } from "@/lib/time";
import { getRangeEvents } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";
import { useCorrelation, type RangeEvt as RangeEvtType } from "@/hooks/useCorrelation";

 type LiveSSEData = { type?: string; data?: { name?: string; timestamp?: string; payload?: { correlationId?: string; statusCode?: number; responseTimeMs?: number; metadata?: Record<string, unknown> } } | Record<string, unknown> };
 type LiveEvt = { id?: string; t?: number; data?: LiveSSEData };
 type RangeEvt = { id: string; name: string; timestamp: string; correlationId?: string; statusCode?: number; responseTimeMs?: number };

export default function ResponsesPage() {
  const [range, setRange] = useState("5m");
  const { clear: clearSse } = useEventStream(100);
  const [live, setLive] = useState(true);
  const [transport, setTransport] = useState<"sse" | "ws">("sse");
  const { events: liveEvents, clear: clearLive, status } = useLiveFeed<LiveSSEData>(live, transport, 100);
  const [manualEvents, setManualEvents] = useState<RangeEvt[]>([]);
  const [showInternal, setShowInternal] = useState(false);

  const fetchRange = async () => {
    const { from, to } = rangeToFromTo(range);
    try {
      const data = (await getRangeEvents({ from, to, userScope: "all", limit: 100 })) as RangeEvt[];
      setManualEvents(data);
      setLive(false);
    } catch (error) {
      console.error("Failed to fetch range data:", error);
      setManualEvents([]);
    }
  };

  useEffect(() => {
    if (!live || transport === "ws") return;
    const timer = setInterval(() => {
      const { from, to } = rangeToFromTo(range);
      getRangeEvents({ from, to, userScope: "all", limit: 100 })
        .then((data) => setManualEvents(data as RangeEvt[]))
        .catch(() => {});
    }, 10000);
    return () => clearInterval(timer);
  }, [range, live, transport]);

  const liveForCorr = useMemo(() => (liveEvents as LiveEvt[]).map((e) => ({ data: e.data, t: e.t })), [liveEvents]);
  const correlated = useCorrelation(liveForCorr, manualEvents as RangeEvtType[], live);

  const [filterName, setFilterName] = useState("");
  const [filterCorr, setFilterCorr] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterStatusExpr, setFilterStatusExpr] = useState("");
  const [filterPath, setFilterPath] = useState("");
  const [sortKey, setSortKey] = useState<'name' | 'correlationId' | 'requestAt' | 'responseAt' | 'statusCode' | 'latencyMs' | 'userId' | 'requestPath' | 'serviceName'>('responseAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const filteredCorrelated = useMemo(() => {
    const is2xx = (s?: number) => typeof s === "number" && s >= 200 && s < 300;
    const is4xx = (s?: number) => typeof s === "number" && s >= 400 && s < 500;
    const is5xx = (s?: number) => typeof s === "number" && s >= 500;
    const statusMatchesExpr = (s?: number) => {
      if (!filterStatusExpr.trim()) return true;
      const tokens = filterStatusExpr.split(/[ ,]+/).filter(Boolean);
      return tokens.some(tok => {
        if (/^\d{3}$/.test(tok)) return s === Number(tok);
        if (/^\dxx$/i.test(tok)) { const n = Number(tok[0]); return typeof s === 'number' && Math.floor(s / 100) === n; }
        if (/^(\d{3})-(\d{3})$/.test(tok)) { const [a,b] = tok.split('-').map(Number); return typeof s === 'number' && s >= a && s <= b; }
        return false;
      });
    };
    const base = correlated.filter((c) => {
      if (filterName && !c.name.toLowerCase().includes(filterName.toLowerCase())) return false;
      if (filterCorr && (c.correlationId ?? "").indexOf(filterCorr) === -1) return false;
      if (filterPath && !(c.requestPath ?? '').toLowerCase().includes(filterPath.toLowerCase())) return false;
      if (filterStatus === "pending" && !c.pending) return false;
      if (filterStatus === "2xx" && !is2xx(c.statusCode)) return false;
      if (filterStatus === "4xx" && !is4xx(c.statusCode)) return false;
      if (filterStatus === "5xx" && !is5xx(c.statusCode)) return false;
      if (!statusMatchesExpr(c.statusCode)) return false;
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
        case 'userId': return obj.userId ?? '';
        case 'requestPath': return obj.requestPath ?? '';
        case 'serviceName': return obj.serviceName ?? '';
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
  }, [correlated, filterName, filterCorr, filterStatus, filterStatusExpr, filterPath, sortKey, sortDir]);

  return (
    <div className="min-h-screen w-full flex flex-col bg-background text-foreground">
      <Header />
      <main className="flex-1 w-full grid grid-cols-12 gap-3 p-3 md:p-6 min-h-0 auto-rows-max">
        <div className="col-span-12">
          <h1 className="text-2xl font-bold">Responses</h1>
        </div>
        <ControlsBar
          range={range}
          setRange={setRange}
          live={live}
          setLive={setLive}
          transport={transport}
          setTransport={setTransport}
          status={status}
          showInternal={showInternal}
          setShowInternal={setShowInternal}
          onFetchRange={fetchRange}
          onClear={async () => { try { await fetch('/api/events/clear', { method: 'POST' }); } catch {}; clearSse(); clearLive(); }}
        />

        <section aria-label="Correlation Analysis" className="col-span-12">
          <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-3">
            <div className="text-sm font-bold mb-3 text-green-400 flex items-center gap-2">
              <span aria-hidden className="fa-solid fa-link" />
              Response Analysis
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
              <input 
                value={filterPath} 
                onChange={(e) => setFilterPath(e.target.value)} 
                placeholder="Filter by request path (/api/...)" 
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
              <input
                value={filterStatusExpr}
                onChange={(e) => setFilterStatusExpr(e.target.value)}
                placeholder="Status expr (e.g. 404, 5xx, 400-499)"
                className="px-2 py-1 rounded border border-neutral-700 bg-neutral-800 text-white placeholder-neutral-500 focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] max-h-[65vh] overflow-auto">
              <table className="w-full text-xs">
                <thead className="bg-neutral-800 text-neutral-300 sticky top-0">
                  <tr>
                    <th className="text-left p-2 font-semibold cursor-pointer" onClick={() => setSortKey(k => { setSortDir(d => (k === 'name' ? (d === 'asc' ? 'desc' : 'asc') : 'desc')); return 'name'; })}>
                      Event {sortKey === 'name' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th className="text-left p-2 font-semibold cursor-pointer" onClick={() => setSortKey(k => { setSortDir(d => (k === 'correlationId' ? (d === 'asc' ? 'desc' : 'asc') : 'desc')); return 'correlationId'; })}>
                      Correlation {sortKey === 'correlationId' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th className="text-left p-2 font-semibold cursor-pointer" onClick={() => setSortKey(k => { setSortDir(d => (k === 'userId' ? (d === 'asc' ? 'desc' : 'asc') : 'desc')); return 'userId'; })}>
                      Actor {sortKey === 'userId' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th className="text-left p-2 font-semibold cursor-pointer" onClick={() => setSortKey(k => { setSortDir(d => (k === 'serviceName' ? (d === 'asc' ? 'desc' : 'asc') : 'desc')); return 'serviceName'; })}>
                      Service {sortKey === 'serviceName' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th className="text-left p-2 font-semibold cursor-pointer" onClick={() => setSortKey(k => { setSortDir(d => (k === 'requestPath' ? (d === 'asc' ? 'desc' : 'asc') : 'desc')); return 'requestPath'; })}>
                      Path {sortKey === 'requestPath' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th className="text-left p-2 font-semibold cursor-pointer" onClick={() => setSortKey(k => { setSortDir(d => (k === 'responseAt' ? (d === 'asc' ? 'desc' : 'asc') : 'desc')); return 'responseAt'; })}>
                      Response {sortKey === 'responseAt' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th className="text-left p-2 font-semibold cursor-pointer" onClick={() => setSortKey(k => { setSortDir(d => (k === 'statusCode' ? (d === 'asc' ? 'desc' : 'asc') : 'desc')); return 'statusCode'; })}>
                      Status {sortKey === 'statusCode' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th className="text-left p-2 font-semibold cursor-pointer" onClick={() => setSortKey(k => { setSortDir(d => (k === 'latencyMs' ? (d === 'asc' ? 'desc' : 'asc') : 'desc')); return 'latencyMs'; })}>
                      Latency {sortKey === 'latencyMs' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCorrelated.map((c) => (
                    <tr key={c.id} className="border-t border-neutral-800 hover:bg-neutral-900/50 transition-colors">
                      <td className="p-2 font-mono text-white">{c.name}</td>
                      <td className="p-2 font-mono text-cyan-300 break-all">{c.correlationId ?? "—"}</td>
                      <td className="p-2 font-mono text-violet-300">{c.userId ?? '—'}</td>
                      <td className="p-2 font-mono text-indigo-300">{c.serviceName ?? '—'}</td>
                      <td className="p-2 font-mono text-neutral-300 break-all">{c.requestPath ?? '—'}</td>
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
      </main>
    </div>
  );
}
