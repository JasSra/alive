function uuid() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback simple UUID v4-ish
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
import type {
  AIEventPayload,
  EventAnalytics,
  EventCount,
  EventStatistics,
  StoredEvent,
  TrackEventResponse,
  AISuggestion,
  BatchTrackEventItem,
} from "./types";

// Use globalThis to ensure shared state across different runtime contexts
const globalStore = globalThis as unknown as {
  __eventStore?: {
    events: StoredEvent[];
    sseClients: Set<SSESend>;
    wsClients: Set<unknown>;
  };
};

if (!globalStore.__eventStore) {
  globalStore.__eventStore = {
    events: [],
    sseClients: new Set(),
    wsClients: new Set(),
  };
}

const { events, sseClients, wsClients } = globalStore.__eventStore;

type SSESend = (chunk: string) => void;

function broadcast(data: unknown) {
  console.log(`[store] Broadcasting to ${sseClients.size} SSE clients and ${wsClients.size} WS clients:`, data);
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const send of sseClients) {
    try {
      console.log("[store] Sending SSE payload");
      send(payload);
    } catch (e) {
      console.error("[store] Failed to send SSE:", e);
      // ignore failed clients
    }
  }
  // WebSocket broadcast (best-effort)
  const wsPayload = JSON.stringify(data);
  for (const ws of wsClients) {
    try {
      const w = ws as { readyState?: number; send: (s: string) => void };
      // 1 === OPEN in browsers; if undefined, try anyway
      if (w.readyState === undefined || w.readyState === 1) {
        w.send(wsPayload);
      }
    } catch {
      // ignore
    }
  }
}

export function registerSSEClient(send: SSESend) {
  console.log("[store] Registering SSE client, total clients:", sseClients.size + 1);
  sseClients.add(send);
  // initial ping
  try {
    send(`event: ping\ndata: {"t":${Date.now()}}\n\n`);
  } catch {
    // ignore
  }
  return () => {
    console.log("[store] Unregistering SSE client");
    sseClients.delete(send);
  };
}

type WSLike = { send: (s: string) => void; addEventListener?: (ev: string, cb: () => void) => void; readyState?: number };
export function registerWSClient(ws: WSLike) {
  wsClients.add(ws);
  try {
    ws.send(JSON.stringify({ type: "ping", t: Date.now() }));
  } catch {}
  const close = () => wsClients.delete(ws);
  try {
    ws.addEventListener?.("close", close);
    ws.addEventListener?.("error", close);
  } catch {}
  return close;
}

export function trackEvent(
  eventName: string,
  payload: AIEventPayload = {},
  userId?: string | null,
): TrackEventResponse {
  const id = uuid();
  const timestamp = Date.now();
  const stored: StoredEvent = {
    id,
    name: eventName,
    userId: userId ?? null,
    payload,
    timestamp,
  };
  events.push(stored);
  // naive suggestions placeholder
  const suggestions: AISuggestion[] = [
    {
      id: uuid(),
      title: `Consider grouping event '${eventName}'`,
      description: "Auto suggestion from demo engine",
      score: 0.3,
    },
  ];

  const response: TrackEventResponse = {
    success: true,
    message: "Tracked",
    suggestions,
    eventId: id,
    timestamp: new Date(timestamp).toISOString(),
  };

  broadcast({ type: "event", data: stored });
  return response;
}

export function trackEventsBatch(
  items: BatchTrackEventItem[],
  userId?: string | null,
) {
  return items.map((it) => trackEvent(it.eventName, it.payload, userId));
}

export function getSuggestions(): AISuggestion[] {
  // Example: suggest top events in recent window
  const counts = aggregateCounts();
  return counts.slice(0, 5).map((c) => ({
  id: uuid(),
    title: `Investigate frequent event '${c.eventName}'`,
    score: Math.min(1, c.count / (events.length || 1)),
  }));
}

export function getAnalytics(
  from: Date,
  to: Date,
  eventPattern?: string | null,
  userId?: string | null,
): EventAnalytics[] {
  const filtered = filterRange(from, to).filter(
    (e) =>
      (!userId || e.userId === userId) &&
      (!eventPattern || e.name.toLowerCase().includes(eventPattern.toLowerCase())),
  );
  const byName = new Map<string, StoredEvent[]>();
  for (const ev of filtered) {
    const arr = byName.get(ev.name) ?? [];
    arr.push(ev);
    byName.set(ev.name, arr);
  }
  return [...byName.entries()].map(([name, arr]) => ({
    eventName: name,
    count: arr.length,
    firstSeen: new Date(Math.min(...arr.map((a) => a.timestamp))).toISOString(),
    lastSeen: new Date(Math.max(...arr.map((a) => a.timestamp))).toISOString(),
  }));
}

export function getUniqueEventNames(
  from: Date,
  to: Date,
  userId?: string | null,
) {
  const set = new Set<string>();
  for (const e of filterRange(from, to)) {
    if (!userId || e.userId === userId) set.add(e.name);
  }
  return [...set];
}

export function getEventCounts(
  from: Date,
  to: Date,
  userId?: string | null,
): EventCount[] {
  const map = new Map<string, number>();
  for (const e of filterRange(from, to)) {
    if (userId && e.userId !== userId) continue;
    map.set(e.name, (map.get(e.name) ?? 0) + 1);
  }
  return [...map.entries()].map(([eventName, count]) => ({ eventName, count }));
}

export function getTotalCount(
  from: Date,
  to: Date,
  userId?: string | null,
) {
  return filterRange(from, to).filter((e) => !userId || e.userId === userId).length;
}

export function getStatistics(
  from: Date,
  to: Date,
  userId?: string | null,
): EventStatistics {
  const filtered = filterRange(from, to).filter((e) => !userId || e.userId === userId);
  const totalEventCount = filtered.length;
  const perDayMap = new Map<string, number>();
  for (const e of filtered) {
    const d = new Date(e.timestamp);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    perDayMap.set(key, (perDayMap.get(key) ?? 0) + 1);
  }
  const perDay = [...perDayMap.entries()]
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const counts = aggregateCounts(filtered);
  return {
    totalEventCount,
    totalUniqueEvents: counts.length,
    perDay,
    topEvents: counts.sort((a, b) => b.count - a.count).slice(0, 10),
  };
}

export function getHistory(
  userId: string,
  from?: Date | null,
  to?: Date | null,
  limit = 100,
) {
  return events
    .filter((e) => e.userId === userId)
    .filter((e) => !from || e.timestamp >= from.getTime())
    .filter((e) => !to || e.timestamp <= to.getTime())
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit)
    .map((e) => ({
      id: e.id,
      name: e.name,
      timestamp: new Date(e.timestamp).toISOString(),
      userId: e.userId ?? undefined,
      userAgent: e.payload.userAgent,
      referrer: e.payload.referrer,
    }));
}

export function getEventsRange(
  from: Date,
  to: Date,
  userId?: string | null,
  limit = 5000,
) {
  const result = events
    .filter((e) => (!userId || e.userId === userId) && e.timestamp >= from.getTime() && e.timestamp <= to.getTime())
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(0, limit)
    .map((e) => ({
      id: e.id,
      name: e.name,
      timestamp: new Date(e.timestamp).toISOString(),
      userId: e.userId ?? undefined,
      correlationId: e.payload.correlationId,
      statusCode: e.payload.statusCode as number | undefined,
      responseTimeMs: e.payload.responseTimeMs as number | undefined,
    }));
  return result;
}

export function cleanupOldData(retentionDays: number) {
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const before = events.length;
  for (let i = events.length - 1; i >= 0; i -= 1) {
    if (events[i].timestamp < cutoff) events.splice(i, 1);
  }
  const removed = before - events.length;
  broadcast({ type: "stats", data: { removed } });
  return removed;
}

function filterRange(from: Date, to: Date) {
  const f = from.getTime();
  const t = to.getTime();
  return events.filter((e) => e.timestamp >= f && e.timestamp <= t);
}

function aggregateCounts(source: StoredEvent[] = events): EventCount[] {
  const map = new Map<string, number>();
  for (const e of source) {
    map.set(e.name, (map.get(e.name) ?? 0) + 1);
  }
  return [...map.entries()].map(([eventName, count]) => ({ eventName, count }));
}
