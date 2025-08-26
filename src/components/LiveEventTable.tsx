import React, { useState } from "react";
import type { AIEventPayload } from "@/lib/types";

import type { LiveEvt } from "../app/page";

interface LiveEventTableProps {
  events: LiveEvt[];
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
  timestamp: number;
  isRequest: boolean;
  original: LiveEvt;
}

export default function LiveEventTable({ events }: LiveEventTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  
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
    
    return {
      name: d?.data && typeof d.data === "object" && "name" in d.data ? String(d.data.name) : d?.type ?? "event",
      correlationId: payload?.correlationId,
      statusCode: payload?.statusCode,
      responseTimeMs: payload?.responseTimeMs,
      userId: d?.data && typeof d.data === "object" && "userId" in d.data ? String(d.data.userId) : undefined,
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
            <th className="text-left p-2 font-semibold">Status</th>
            <th className="text-left p-2 font-semibold">Latency</th>
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
                  <td className="p-2">
                    {typeof status === "number" ? (
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded font-bold ${getStatusColor(status)}`}>
                        {status === 0 ? "📤" : status >= 400 ? "❌" : "✅"}
                        {status}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="p-2 font-mono">
                    {typeof latency === "number" ? (
                      <span className={latency > 1000 ? "text-rose-300" : latency > 500 ? "text-amber-300" : "text-emerald-300"}>
                        {latency} ms
                      </span>
                    ) : "—"}
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
                    <td className="p-2">
                      {typeof evt.statusCode === "number" ? (
                        <span className={`inline-flex items-center gap-1 px-1 py-0.5 rounded text-xs font-bold ${getStatusColor(evt.statusCode)}`}>
                          {evt.statusCode}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="p-2 font-mono text-xs">
                      {typeof evt.responseTimeMs === "number" ? `${evt.responseTimeMs} ms` : "—"}
                    </td>
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
              <td className="p-2">
                {typeof evt.statusCode === "number" ? (
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded font-bold ${getStatusColor(evt.statusCode)}`}>
                    {evt.statusCode === 0 ? "📤" : evt.statusCode >= 400 ? "❌" : "✅"}
                    {evt.statusCode}
                  </span>
                ) : "—"}
              </td>
              <td className="p-2 font-mono">
                {typeof evt.responseTimeMs === "number" ? (
                  <span className={evt.responseTimeMs > 1000 ? "text-rose-300" : evt.responseTimeMs > 500 ? "text-amber-300" : "text-emerald-300"}>
                    {evt.responseTimeMs} ms
                  </span>
                ) : "—"}
              </td>
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
