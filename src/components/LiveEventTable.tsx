import React, { useState } from "react";
import type { AIEventPayload } from "@/lib/types";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faServer, faArrowRight, faUser, faBox, faCompass } from "@fortawesome/free-solid-svg-icons";

import type { LiveEvt } from "../app/page";

interface LiveEventTableProps {
  events: LiveEvt[];
  viewingMode?: 'all' | 'requests' | 'responses' | 'events' | 'analytics';
}

function getStatusColor(status?: number) {
  if (typeof status !== "number") return "bg-neutral-800 text-neutral-400";
  if (status >= 500) return "bg-rose-500/20 text-rose-200";
  if (status >= 400) return "bg-amber-500/20 text-amber-200";
  if (status >= 200) return "bg-emerald-500/20 text-emerald-200";
  return "bg-neutral-800 text-neutral-400";
}

interface EventData {
  name: string;
  correlationId?: string;
  statusCode?: number;
  responseTimeMs?: number;
  userId?: string;
  sessionId?: string | null;
  serviceName?: string;
  userAgent?: string;
  method?: string;
  path?: string;
  contentLength?: number | null;
  timestamp: number;
  isRequest: boolean;
  original: LiveEvt;
}

export default function LiveEventTable({ events, viewingMode = 'all' }: LiveEventTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const iconClass = "text-neutral-500";

  const fmtBytes = (v?: number | null) => {
    if (v == null || isNaN(v)) return "—";
    if (v < 1024) return `${v} B`;
    if (v < 1024 * 1024) return `${(v / 1024).toFixed(1)} KB`;
    return `${(v / (1024 * 1024)).toFixed(1)} MB`;
  };

  const userColorClass = (id?: string) => {
    if (!id) return "bg-neutral-600";
    let hash = 0;
    for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
    const palette = [
      "bg-rose-600", "bg-fuchsia-600", "bg-purple-600", "bg-indigo-600",
      "bg-blue-600", "bg-cyan-600", "bg-teal-600", "bg-emerald-600",
      "bg-lime-600", "bg-amber-600", "bg-orange-600", "bg-red-600",
    ];
    return palette[hash % palette.length];
  };
  
  if (events.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-neutral-500">
        <div className="text-center">
          <div className="text-4xl mb-2">⚡</div>
          <div className="text-sm">No live events yet</div>
          <div className="text-xs mt-1">Run the seeder to see data</div>
        </div>
      </div>
    );
  }

  // Parse events and extract data
  const parsedEvents: EventData[] = events.map(e => {
    const d = e.data;
    const payload: Partial<AIEventPayload> | undefined = d?.data && typeof d.data === "object" && "payload" in d.data ? (d.data.payload as Partial<AIEventPayload>) : undefined;
    const rawMeta = payload?.metadata;
    const metaObj = (rawMeta && typeof rawMeta === 'object') ? (rawMeta as Record<string, unknown>) : undefined;
    const method = typeof metaObj?.["method"] === "string" ? (metaObj?.["method"] as string) : undefined;
    const path = typeof metaObj?.["path"] === "string" ? (metaObj?.["path"] as string) : (typeof metaObj?.["url"] === "string" ? (metaObj?.["url"] as string) : undefined);
    const contentLength = typeof metaObj?.["contentLength"] === "number" ? (metaObj?.["contentLength"] as number) : null;

    const pRec = (payload && typeof payload === 'object') ? (payload as Record<string, unknown>) : undefined;
    const userIdFromPayload = typeof pRec?.["userId"] === "string" ? (pRec?.["userId"] as string) : undefined;
    const sessionFromPayload = typeof pRec?.["sessionId"] === "string" ? (pRec?.["sessionId"] as string) : undefined;
    const serviceFromPayload = typeof pRec?.["serviceName"] === "string" ? (pRec?.["serviceName"] as string) : undefined;
    const uaFromPayload = typeof pRec?.["userAgent"] === "string" ? (pRec?.["userAgent"] as string) : undefined;

    const dataObj = (d?.data && typeof d.data === 'object') ? (d.data as Record<string, unknown>) : undefined;
    const userIdTop = typeof dataObj?.["userId"] === "string" ? (dataObj?.["userId"] as string) : undefined;
    
    // Prefer path as the display name for request/response; fallback to event name/type
    const rawName = d?.data && typeof d.data === "object" && "name" in d.data ? String(d.data.name) : d?.type ?? "event";
    const displayName = path ? `${method ? method.toUpperCase() + " " : ""}${path}` : rawName;
    return {
      name: displayName,
      correlationId: payload?.correlationId,
      statusCode: payload?.statusCode,
      responseTimeMs: payload?.responseTimeMs,
      userId: userIdFromPayload ?? userIdTop ?? undefined,
      sessionId: sessionFromPayload ?? null,
      serviceName: serviceFromPayload,
      userAgent: uaFromPayload,
      method,
      path,
      contentLength,
      timestamp: e.t ?? Date.now(),
      isRequest: payload?.statusCode === 0,
      original: e
    };
  });

  // Group by correlation ID and sort
  const grouped = new Map<string, EventData[]>();
  const orphaned: EventData[] = [];
  
  for (const evt of parsedEvents) {
    if (evt.correlationId) {
      if (!grouped.has(evt.correlationId)) grouped.set(evt.correlationId, []);
      grouped.get(evt.correlationId)!.push(evt);
    } else {
      orphaned.push(evt);
    }
  }

  // Sort groups by latest timestamp and sort within groups
  const sortedGroups = Array.from(grouped.entries())
    .map(([corrId, events]) => {
      const sorted = events.sort((a, b) => a.timestamp - b.timestamp); // Request first, then response
      const latestTime = Math.max(...sorted.map(e => e.timestamp));
      return { corrId, events: sorted, latestTime };
    })
    .sort((a, b) => b.latestTime - a.latestTime);

  // Sort orphaned events
  const sortedOrphaned = orphaned.sort((a, b) => b.timestamp - a.timestamp);

  const toggleExpanded = (id: string) => {
    const newSet = new Set(expandedRows);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedRows(newSet);
  };

  return (
    <div className="h-full overflow-auto">
  <table className="w-full text-xs">
        <thead className="bg-neutral-800 text-neutral-300 sticky top-0 z-10">
          <tr>
            <th className="text-left p-2 font-semibold">Time</th>
            <th className="text-left p-2 font-semibold">Event</th>
            <th className="text-left p-2 font-semibold min-w-[120px]">Correlation</th>
            {(viewingMode === 'all' || viewingMode === 'responses') && (
              <th className="text-left p-2 font-semibold">Status</th>
            )}
            {(viewingMode === 'all' || viewingMode === 'responses') && (
              <th className="text-left p-2 font-semibold">Latency</th>
            )}
    <th className="text-left p-2 font-semibold">Info</th>
    <th className="text-left p-2 font-semibold">Data</th>
          </tr>
        </thead>
        <tbody>
          {/* Render grouped events (request/response pairs) */}
          {sortedGroups.map(({ corrId, events }) => {
            const isExpanded = expandedRows.has(corrId);
            const requestEvent = events.find(e => e.isRequest);
            const responseEvent = events.find(e => !e.isRequest);
            const latency = responseEvent?.responseTimeMs;
            const status = responseEvent?.statusCode ?? requestEvent?.statusCode;
            
            return (
              <React.Fragment key={corrId}>
                {/* Group header row */}
                <tr 
                  className="border-t border-neutral-800 hover:bg-neutral-900/50 transition-colors cursor-pointer" 
                  onClick={() => toggleExpanded(corrId)}
                >
                  <td className="p-2 font-mono text-neutral-300">
                    {new Date(Math.max(...events.map(e => e.timestamp))).toLocaleTimeString()}
                  </td>
                  <td className="p-2">
                    <div className="flex items-center gap-1">
                      <span className="text-neutral-500">{isExpanded ? '▼' : '▶'}</span>
                      <span className="font-mono text-blue-400">{requestEvent?.name || responseEvent?.name}</span>
                      {events[0].userId && <span className="text-xs text-neutral-500">({events[0].userId})</span>}
                    </div>
                  </td>
                  <td className="p-2 font-mono text-xs">
                    <div className="flex items-center gap-1">
                      <span className="text-purple-400 font-medium" title={corrId}>
                        {corrId.slice(-8)}
                      </span>
                      <span className="text-neutral-600 text-xs">({events.length})</span>
                    </div>
                  </td>
                  {(viewingMode === 'all' || viewingMode === 'responses') && (
                    <td className="p-2">
                      {typeof status === "number" ? (
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded font-bold ${getStatusColor(status)}`}>
                          {status === 0 ? "📤" : status >= 400 ? "❌" : "✅"}
                          {status}
                        </span>
                      ) : "—"}
                    </td>
                  )}
                  {(viewingMode === 'all' || viewingMode === 'responses') && (
                    <td className="p-2 font-mono">
                      {typeof latency === "number" ? (
                        <span className={latency > 1000 ? "text-rose-300" : latency > 500 ? "text-amber-300" : "text-emerald-300"}>
                          {latency} ms
                        </span>
                      ) : "—"}
                    </td>
                  )}
                  <td className="p-2 text-neutral-300">
                    <div className="flex flex-wrap gap-2 items-center">
                      {events[0].serviceName && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-neutral-700">
                          <FontAwesomeIcon icon={faServer} className={iconClass} />
                          {events[0].serviceName}
                        </span>
                      )}
                      {(requestEvent?.method || requestEvent?.path || responseEvent?.method || responseEvent?.path) && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-neutral-700">
                          <FontAwesomeIcon icon={faArrowRight} className={iconClass} />
                          <span className="font-mono">{requestEvent?.method || responseEvent?.method || "—"}</span>
                          <span className="text-neutral-500">{(requestEvent?.path || responseEvent?.path || "").slice(0, 32)}</span>
                        </span>
                      )}
                      {events[0].userId && (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-white ${userColorClass(events[0].userId)}`}
                          title={`userId: ${events[0].userId}${events[0].sessionId ? `, session: ${events[0].sessionId}` : ''}`}
                        >
                          <FontAwesomeIcon icon={faUser} className="opacity-90" />
                          {events[0].userId}
                        </span>
                      )}
                      {(requestEvent?.userAgent || responseEvent?.userAgent) && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-neutral-700" title={requestEvent?.userAgent || responseEvent?.userAgent}>
                          <FontAwesomeIcon icon={faCompass} className={iconClass} />
                          <span className="truncate max-w-[140px]">
                            {(requestEvent?.userAgent || responseEvent?.userAgent || '').split(' ').slice(-1)[0]}
                          </span>
                        </span>
                      )}
                      {(requestEvent?.contentLength != null || responseEvent?.contentLength != null) && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-neutral-700">
                          <FontAwesomeIcon icon={faBox} className={iconClass} />
                          {fmtBytes(requestEvent?.contentLength ?? responseEvent?.contentLength ?? null)}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-2 text-neutral-500">
                    <span className="text-xs">
                      {requestEvent && responseEvent ? "Request → Response" : requestEvent ? "Request only" : "Response only"}
                    </span>
                  </td>
                </tr>
                
                {/* Nested event details */}
                {isExpanded && events.map((evt, index) => (
                  <tr key={`${corrId}-${index}`} className="border-t border-neutral-700/50 bg-neutral-900/30">
                    <td className="p-2 pl-6 font-mono text-xs text-neutral-400">
                      {new Date(evt.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="p-2 pl-6">
                      <div className="flex items-center gap-1">
                        <span className="text-neutral-600">└─</span>
                        <span className="text-xs">
                          {evt.isRequest ? (
                            <span className="text-yellow-400">📤 Request</span>
                          ) : (
                            <span className="text-green-400">📥 Response</span>
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="p-2 font-mono text-xs text-neutral-600">↳</td>
                    {(viewingMode === 'all' || viewingMode === 'responses') && (
                      <td className="p-2">
                        {typeof evt.statusCode === "number" ? (
                          <span className={`inline-flex items-center gap-1 px-1 py-0.5 rounded text-xs font-bold ${getStatusColor(evt.statusCode)}`}>
                            {evt.statusCode}
                          </span>
                        ) : "—"}
                      </td>
                    )}
                    {(viewingMode === 'all' || viewingMode === 'responses') && (
                      <td className="p-2 font-mono text-xs">
                        {typeof evt.responseTimeMs === "number" ? `${evt.responseTimeMs} ms` : "—"}
                      </td>
                    )}
                    <td className="p-2">
                      <details className="cursor-pointer">
                        <summary className="text-xs text-neutral-500 truncate max-w-xs">
                          View JSON
                        </summary>
                        <pre className="mt-1 text-xs bg-neutral-950 p-2 rounded overflow-auto max-w-sm">
                          {JSON.stringify(evt.original.data, null, 2)}
                        </pre>
                      </details>
                    </td>
                    <td className="p-2 text-neutral-300">
                      <div className="flex flex-wrap gap-2 items-center">
                        {evt.serviceName && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-neutral-700"><FontAwesomeIcon icon={faServer} className={iconClass} />{evt.serviceName}</span>
                        )}
                        {(evt.method || evt.path) && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-neutral-700"><FontAwesomeIcon icon={faArrowRight} className={iconClass} /><span className="font-mono">{evt.method}</span><span className="text-neutral-500">{(evt.path || '').slice(0, 40)}</span></span>
                        )}
                        {evt.userId && (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-white ${userColorClass(evt.userId)}`}><FontAwesomeIcon icon={faUser} className="opacity-90" />{evt.userId}</span>
                        )}
                        {evt.userAgent && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-neutral-700" title={evt.userAgent}><FontAwesomeIcon icon={faCompass} className={iconClass} /><span className="truncate max-w-[160px]">{evt.userAgent.split(' ').slice(-1)[0]}</span></span>
                        )}
                        {evt.contentLength != null && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-neutral-700"><FontAwesomeIcon icon={faBox} className={iconClass} />{fmtBytes(evt.contentLength)}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            );
          })}
          
          {/* Render orphaned events (no correlation ID) */}
          {sortedOrphaned.map((evt) => (
            <tr key={evt.original.id ?? evt.timestamp} className="border-t border-neutral-800 hover:bg-neutral-900/50 transition-colors">
              <td className="p-2 font-mono text-neutral-300">
                {new Date(evt.timestamp).toLocaleTimeString()}
              </td>
              <td className="p-2">
                <span className="font-mono text-blue-400">{evt.name}</span>
                {evt.userId && <div className="text-xs text-neutral-500">{evt.userId}</div>}
              </td>
              <td className="p-2 font-mono text-xs text-neutral-600">—</td>
              {(viewingMode === 'all' || viewingMode === 'responses') && (
                <td className="p-2">
                  {typeof evt.statusCode === "number" ? (
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded font-bold ${getStatusColor(evt.statusCode)}`}>
                      {evt.statusCode === 0 ? "📤" : evt.statusCode >= 400 ? "❌" : "✅"}
                      {evt.statusCode}
                    </span>
                  ) : "—"}
                </td>
              )}
              {(viewingMode === 'all' || viewingMode === 'responses') && (
                <td className="p-2 font-mono">
                  {typeof evt.responseTimeMs === "number" ? (
                    <span className={evt.responseTimeMs > 1000 ? "text-rose-300" : evt.responseTimeMs > 500 ? "text-amber-300" : "text-emerald-300"}>
                      {evt.responseTimeMs} ms
                    </span>
                  ) : "—"}
                </td>
              )}
              <td className="p-2">
                <details className="cursor-pointer">
                  <summary className="text-xs text-neutral-500 truncate max-w-xs">
                    {evt.name}
                  </summary>
                  <pre className="mt-1 text-xs bg-neutral-950 p-2 rounded overflow-auto max-w-sm">
                    {JSON.stringify(evt.original.data, null, 2)}
                  </pre>
                </details>
              </td>
              <td className="p-2 text-neutral-300">
                <div className="flex flex-wrap gap-2 items-center">
                  {evt.serviceName && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-neutral-700"><FontAwesomeIcon icon={faServer} className={iconClass} />{evt.serviceName}</span>
                  )}
                  {(evt.method || evt.path) && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-neutral-700"><FontAwesomeIcon icon={faArrowRight} className={iconClass} /><span className="font-mono">{evt.method}</span><span className="text-neutral-500">{(evt.path || '').slice(0, 40)}</span></span>
                  )}
                  {evt.userId && (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-white ${userColorClass(evt.userId)}`}><FontAwesomeIcon icon={faUser} className="opacity-90" />{evt.userId}</span>
                  )}
                  {evt.userAgent && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-neutral-700" title={evt.userAgent}><FontAwesomeIcon icon={faCompass} className={iconClass} /><span className="truncate max-w-[160px]">{evt.userAgent.split(' ').slice(-1)[0]}</span></span>
                  )}
                  {evt.contentLength != null && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-neutral-700"><FontAwesomeIcon icon={faBox} className={iconClass} />{fmtBytes(evt.contentLength)}</span>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
