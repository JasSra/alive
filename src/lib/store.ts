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
import { logger } from "./logger";

// Use globalThis to ensure shared state across different runtime contexts
const globalStore = globalThis as unknown as {
  __eventStore?: {
    events: StoredEvent[];
    sseClients: Set<SSESend>;
    wsClients: Set<unknown>;
  buckets: Map<number, MinuteBucket>; // key: minute start epoch ms
  };
};

if (!globalStore.__eventStore) {
  globalStore.__eventStore = {
    events: [],
    sseClients: new Set(),
    wsClients: new Set(),
    buckets: new Map(),
  };
}

const { events, sseClients, wsClients, buckets } = globalStore.__eventStore;

// --------------------
// Aggregation Buckets
// --------------------
export type MinuteBucket = {
  startMs: number; // minute floor
  reqCount: number;
  respCount: number;
  statusCounts: Map<number, number>; // e.g., 200 -> 12
  pathCounts: Map<string, number>; // e.g., /api/events/track/:event -> 7
  // Welford stats for response latency (ms)
  latency: { count: number; mean: number; M2: number; min: number; max: number; sum: number };
};

function minuteFloor(ts: number) { return ts - (ts % 60000); }

function getOrCreateBucket(ms: number): MinuteBucket {
  const key = minuteFloor(ms);
  let b = buckets.get(key);
  if (!b) {
    b = {
      startMs: key,
      reqCount: 0,
      respCount: 0,
      statusCounts: new Map(),
      pathCounts: new Map(),
      latency: { count: 0, mean: 0, M2: 0, min: Number.POSITIVE_INFINITY, max: 0, sum: 0 },
    };
    buckets.set(key, b);
  }
  return b;
}

function welfordAdd(b: MinuteBucket, x: number) {
  const s = b.latency;
  s.count += 1;
  const delta = x - s.mean;
  s.mean += delta / s.count;
  const delta2 = x - s.mean;
  s.M2 += delta * delta2;
  s.min = Math.min(s.min, x);
  s.max = Math.max(s.max, x);
  s.sum += x;
}

function inc<K>(map: Map<K, number>, key: K, by = 1) { map.set(key, (map.get(key) ?? 0) + by); }

function updateBucketsForEvent(e: StoredEvent) {
  const b = getOrCreateBucket(e.timestamp);
  const status = typeof e.payload?.statusCode === 'number' ? (e.payload.statusCode as number) : undefined;
  const isRequest = status === 0;
  const isResponse = typeof status === 'number' && status > 0;
  const path = (e.payload?.metadata as Record<string, unknown> | undefined)?.requestPath as string | undefined;
  if (isRequest) b.reqCount += 1;
  if (isResponse) {
    b.respCount += 1;
    inc(b.statusCounts, status!, 1);
    const rt = e.payload?.responseTimeMs as number | undefined;
    if (typeof rt === 'number' && rt >= 0) welfordAdd(b, rt);
  }
  if (path) inc(b.pathCounts, path, 1);
}

export type AggregatedPoint = {
  t: string; // ISO of window start
  reqCount: number;
  respCount: number;
  statusCounts: Record<string, number>;
  pathCounts: Record<string, number>;
  latency: { count: number; avg?: number; stdDev?: number; min?: number; max?: number; sum?: number };
};

function mergeStats(dst: { count: number; mean: number; M2: number; min: number; max: number; sum: number }, src: { count: number; mean: number; M2: number; min: number; max: number; sum: number }) {
  if (src.count === 0) return;
  if (dst.count === 0) {
    Object.assign(dst, src);
    return;
  }
  const n1 = dst.count, n2 = src.count;
  const delta = src.mean - dst.mean;
  dst.count = n1 + n2;
  dst.mean = dst.mean + delta * (n2 / dst.count);
  dst.M2 = dst.M2 + src.M2 + (delta * delta) * n1 * n2 / dst.count;
  dst.min = Math.min(dst.min, src.min);
  dst.max = Math.max(dst.max, src.max);
  dst.sum += src.sum;
}

export function getTimeBuckets(from: Date, to: Date, stepMinutes = 5, topNPaths = 10): AggregatedPoint[] {
  const start = minuteFloor(from.getTime());
  const end = minuteFloor(to.getTime());
  const stepMs = Math.max(1, stepMinutes) * 60000;
  const results: AggregatedPoint[] = [];
  for (let w = start; w <= end; w += stepMs) {
    const wEnd = Math.min(end, w + stepMs - 60000); // last minute in window
    let reqCount = 0;
    let respCount = 0;
    const status = new Map<number, number>();
    const paths = new Map<string, number>();
    const stats = { count: 0, mean: 0, M2: 0, min: Number.POSITIVE_INFINITY, max: 0, sum: 0 };
    for (let m = w; m <= wEnd; m += 60000) {
      const b = buckets.get(m);
      if (!b) continue;
      reqCount += b.reqCount;
      respCount += b.respCount;
      for (const [k, v] of b.statusCounts) inc(status, k, v);
      for (const [k, v] of b.pathCounts) inc(paths, k, v);
      mergeStats(stats, b.latency);
    }
    // Top N paths
    const topPaths = [...paths.entries()].sort((a, b) => b[1] - a[1]).slice(0, topNPaths);
    const statusObj: Record<string, number> = {};
    for (const [k, v] of status) statusObj[String(k)] = v;
    const pathObj: Record<string, number> = {};
    for (const [k, v] of topPaths) pathObj[k] = v;
    const variance = stats.count > 1 ? stats.M2 / (stats.count - 1) : 0;
    const stdDev = stats.count > 1 ? Math.sqrt(variance) : undefined;
    const avg = stats.count > 0 ? stats.sum / stats.count : undefined;
    results.push({
      t: new Date(w).toISOString(),
      reqCount,
      respCount,
      statusCounts: statusObj,
      pathCounts: pathObj,
      latency: {
        count: stats.count,
        avg,
        stdDev,
        min: stats.count ? stats.min : undefined,
        max: stats.count ? stats.max : undefined,
        sum: stats.count ? stats.sum : undefined,
      },
    });
  }
  return results;
}

type SSESend = (chunk: string) => void;

function broadcast(data: unknown) {
  logger.store('info', `📡 Broadcasting to clients`, { 
    sseClients: sseClients.size, 
    wsClients: wsClients.size 
  });
  console.log(`[store] Broadcasting to ${sseClients.size} SSE clients and ${wsClients.size} WS clients:`, data);
  
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  let sseSuccess = 0;
  let sseErrors = 0;
  
  for (const send of sseClients) {
    try {
      console.log("[store] Sending SSE payload");
      send(payload);
      sseSuccess++;
    } catch (e) {
      sseErrors++;
      logger.store('warn', `⚠️ Failed to send SSE`, { error: e instanceof Error ? e.message : 'Unknown error' });
      console.error("[store] Failed to send SSE:", e);
      // ignore failed clients
    }
  }
  
  // WebSocket broadcast (best-effort)
  const wsPayload = JSON.stringify(data);
  let wsSuccess = 0;
  let wsErrors = 0;
  
  for (const ws of wsClients) {
    try {
      const w = ws as { readyState?: number; send: (s: string) => void };
      // 1 === OPEN in browsers; if undefined, try anyway
      if (w.readyState === undefined || w.readyState === 1) {
        w.send(wsPayload);
        wsSuccess++;
      }
    } catch {
      wsErrors++;
    }
  }
  
  logger.store('debug', `📡 Broadcast complete`, {
    sse: { success: sseSuccess, errors: sseErrors },
    ws: { success: wsSuccess, errors: wsErrors }
  });
}

export function registerSSEClient(send: SSESend) {
  const clientId = Math.random().toString(36).substr(2, 9);
  logger.sse('info', `➕ Registering SSE client`, { 
    clientId,
    totalClients: sseClients.size + 1 
  });
  console.log("[store] Registering SSE client, total clients:", sseClients.size + 1);
  
  sseClients.add(send);
  
  // Log connection statistics periodically
  logger.connectionStats(sseClients.size, wsClients.size);
  
  // initial ping
  try {
    send(`event: ping\ndata: {"t":${Date.now()}}\n\n`);
  } catch {
    // ignore
  }
  return () => {
    logger.sse('info', `➖ Unregistering SSE client`, { 
      clientId,
      remainingClients: sseClients.size - 1 
    });
    console.log("[store] Unregistering SSE client");
    sseClients.delete(send);
    logger.connectionStats(sseClients.size, wsClients.size);
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

// --- Unified-ingest publishing adapter ---
// Allows unifiedIngest to surface request/response/log events into the existing
// live SSE/WS stream and aggregation buckets without depending on legacy storage.
export function publishUnifiedEvent(evt: {
  id?: string;
  name: string;
  timestamp?: number; // epoch ms
  payload?: Record<string, unknown>;
}) {
  const id = evt.id ?? uuid();
  const timestamp = evt.timestamp ?? Date.now();
  const stored: StoredEvent = {
    id,
    name: evt.name,
    userId: null,
    payload: (evt.payload ?? {}) as AIEventPayload,
    timestamp,
  };
  try {
    // feed into analytics buckets used by /api/events/* endpoints
    updateBucketsForEvent(stored);
  } catch {}
  try {
    // Live stream for SSE/WS clients
    broadcast({ type: "event", data: stored });
  } catch {}
  return id;
}

export function publishUnifiedRequest(req: {
  t: number;
  service?: string;
  method?: string;
  path?: string;
  status?: number;
  duration_ms?: number;
  attrs?: Record<string, unknown>;
}) {
  // Derive a correlation id if provided by attributes
  const corr = (req.attrs?.["correlationId"] as string | undefined)
    || (req.attrs?.["http.request_id"] as string | undefined)
    || (req.attrs?.["traceId"] as string | undefined);
  const payloadBase: Record<string, unknown> = {
    correlationId: corr,
    statusCode: req.status ?? undefined,
    responseTimeMs: req.duration_ms ?? undefined,
    serviceName: req.service ?? undefined,
    metadata: {
      method: req.method,
      path: req.path,
      url: req.path,
      requestPath: req.path,
    },
  };
  // Emit a request-start synthetic event when we have duration
  if (typeof req.duration_ms === "number" && req.duration_ms >= 0) {
    publishUnifiedEvent({
      name: "request",
      timestamp: Math.max(0, req.t - req.duration_ms),
      payload: { ...payloadBase, statusCode: 0 },
    });
  }
  // Emit the response event
  publishUnifiedEvent({
    name: "response",
    timestamp: req.t,
    payload: payloadBase,
  });
}

export function publishUnifiedLog(log: {
  t: number;
  service?: string;
  severity?: number | string;
  message: string;
  attrs?: Record<string, unknown>;
}) {
  publishUnifiedEvent({
    name: "log",
    timestamp: log.t,
    payload: {
      serviceName: log.service,
      severity: log.severity,
      message: log.message,
      metadata: log.attrs,
    },
  });
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
  try { updateBucketsForEvent(stored); } catch {}
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
  const byService = new Map<string, StoredEvent[]>();
  for (const e of filtered) {
    const d = new Date(e.timestamp);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    perDayMap.set(key, (perDayMap.get(key) ?? 0) + 1);
  const svc = String(e.payload.serviceName ?? 'unknown');
  if (!byService.has(svc)) byService.set(svc, []);
  byService.get(svc)!.push(e);
  }
  const perDay = [...perDayMap.entries()]
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const counts = aggregateCounts(filtered);
  const serviceBreakdown = [...byService.entries()].map(([serviceName, eventsForSvc]) => {
    const svcCounts = aggregateCounts(eventsForSvc);
    const lastSeenTs = Math.max(...eventsForSvc.map((e) => e.timestamp));
    const errors = eventsForSvc.filter((e) => typeof e.payload?.statusCode === 'number' && (e.payload.statusCode as number) >= 400).length;
    const avgLatencyArr = eventsForSvc.map((e) => e.payload?.responseTimeMs).filter((v): v is number => typeof v === 'number');
    const avgResponseTime = avgLatencyArr.length ? Math.round(avgLatencyArr.reduce((a, b) => a + b, 0) / avgLatencyArr.length) : undefined;
    return {
      serviceName,
  eventCount: eventsForSvc.length,
      uniqueEvents: svcCounts.length,
      avgResponseTime,
  errorRate: eventsForSvc.length ? Math.round((errors / eventsForSvc.length) * 100) : 0,
      lastSeen: new Date(lastSeenTs || Date.now()).toISOString(),
      topEvents: svcCounts.sort((a, b) => b.count - a.count).slice(0, 5),
    };
  });
  return {
    totalEventCount,
    totalUniqueEvents: counts.length,
    totalServices: serviceBreakdown.length,
    perDay,
    topEvents: counts.sort((a, b) => b.count - a.count).slice(0, 10),
    serviceBreakdown,
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
  serviceName: (e.payload?.serviceName as string | undefined) ?? undefined,
      correlationId: e.payload.correlationId,
      statusCode: e.payload.statusCode as number | undefined,
      responseTimeMs: e.payload.responseTimeMs as number | undefined,
  requestPath: (e.payload?.metadata as Record<string, unknown> | undefined)?.requestPath as string | undefined,
  referrer: e.payload?.referrer,
    }));
  return result;
}

export function getDebugInfo() {
  return {
    totalEvents: events.length,
    lastFewEvents: events.slice(-10).map(e => ({
      id: e.id,
      name: e.name,
      timestamp: new Date(e.timestamp).toISOString(),
      userId: e.userId
    })),
    sseClients: sseClients.size,
    wsClients: wsClients.size
  };
}

export function cleanupOldData(retentionDays: number) {
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const before = events.length;
  for (let i = events.length - 1; i >= 0; i -= 1) {
    if (events[i].timestamp < cutoff) events.splice(i, 1);
  }
  const removed = before - events.length;
  broadcast({ type: "stats", data: { removed } });
  // prune buckets older than cutoff
  for (const key of buckets.keys()) {
    if (key < cutoff) buckets.delete(key);
  }
  return removed;
}

// Danger: clears ALL events from memory (demo use)
export function clearAllEvents() {
  const removed = events.length;
  events.length = 0;
  try {
    broadcast({ type: "stats", data: { cleared: removed, t: Date.now() } });
  } catch {}
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
