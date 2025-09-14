// Simple in-memory ring buffers for unified ingest (requests, logs, events)
// Capacity is config driven via env or defaults to 2000 items each

import type { TrackEventResponse, AISuggestion, AIEventPayload } from "./types";

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

export type IngestKind = "requests" | "logs" | "events" | "metrics" | "raw";

export type RequestItem = {
  t: number; // epoch ms
  service?: string;
  method?: string;
  path?: string;
  status?: number;
  duration_ms?: number;
  attrs?: Record<string, unknown>;
  raw?: unknown;
};

export type LogItem = {
  t: number;
  service?: string;
  severity?: number | string;
  message: string;
  attrs?: Record<string, unknown>;
  raw?: unknown;
};

export type EventItem = {
  t: number;
  service?: string;
  name: string;
  attrs?: Record<string, unknown>;
  raw?: unknown;
};

export type MetricItem = {
  t: number;
  service?: string;
  name: string;
  value?: number | string;
  unit?: string;
  kind?: string; // gauge | sum | histogram_* | ...
  attrs?: Record<string, unknown>;
  raw?: unknown;
};

export type RawItem = {
  t: number;
  service?: string;
  dataType?: string; // hint about what kind of raw data this is
  content: unknown; // the actual raw data payload
  contentType?: string; // mime type or content type hint
  source?: string; // where this data came from
  attrs?: Record<string, unknown>;
  raw?: unknown;
};

type Ring<T> = { data: T[]; idx: number; cap: number };

function createRing<T>(cap: number): Ring<T> {
  return { data: new Array<T>(0), idx: 0, cap };
}

function pushRing<T>(ring: Ring<T>, item: T) {
  if (ring.data.length < ring.cap) {
    ring.data.push(item);
    ring.idx = ring.data.length % ring.cap;
  } else {
    ring.data[ring.idx] = item;
    ring.idx = (ring.idx + 1) % ring.cap;
  }
}

function snapshot<T>(ring: Ring<T>): T[] {
  if (ring.data.length < ring.cap) return [...ring.data];
  // Return in chronological order
  return [...ring.data.slice(ring.idx), ...ring.data.slice(0, ring.idx)];
}

const globalStore = globalThis as unknown as {
  __unifiedIngest?: {
    requests: Ring<RequestItem>;
    logs: Ring<LogItem>;
    events: Ring<EventItem>;
    metrics: Ring<MetricItem>;
    raw: Ring<RawItem>;
  };
};

const CAP = Number(process.env.UNIFIED_INGEST_CAP || 2000);

if (!globalStore.__unifiedIngest) {
  globalStore.__unifiedIngest = {
    requests: createRing<RequestItem>(CAP),
    logs: createRing<LogItem>(CAP),
    events: createRing<EventItem>(CAP),
    metrics: createRing<MetricItem>(CAP),
    raw: createRing<RawItem>(CAP),
  };
}

const store = globalStore.__unifiedIngest!;

// SSE and WebSocket client management
type SSESend = (chunk: string) => void;
type WSLike = { send: (s: string) => void; addEventListener?: (ev: string, cb: () => void) => void; readyState?: number };

const globalStreaming = globalThis as unknown as {
  __streamingClients?: {
    sseClients: Set<SSESend>;
    wsClients: Set<WSLike>;
  };
};

if (!globalStreaming.__streamingClients) {
  globalStreaming.__streamingClients = {
    sseClients: new Set(),
    wsClients: new Set(),
  };
}

const { sseClients, wsClients } = globalStreaming.__streamingClients;

function broadcast(data: unknown) {
  console.log(`[ingestStore] Broadcasting to ${sseClients.size} SSE clients and ${wsClients.size} WS clients:`, data);
  
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  
  for (const send of sseClients) {
    try {
      send(payload);
    } catch (e) {
      console.error("[ingestStore] Failed to send SSE:", e);
    }
  }
  
  // WebSocket broadcast (best-effort)
  const wsPayload = JSON.stringify(data);
  for (const ws of wsClients) {
    try {
      const w = ws as { readyState?: number; send: (s: string) => void };
      if (w.readyState === undefined || w.readyState === 1) {
        w.send(wsPayload);
      }
    } catch {
      // ignore failed ws clients
    }
  }
}

export const ingestStore = {
  push(kind: IngestKind, item: RequestItem | LogItem | EventItem | MetricItem | RawItem) {
    const beforeCounts = this.counts();
    
    if (kind === "requests") {
      const req = item as RequestItem;
      console.log(`[STORE] 🌐 Storing request: ${req.method || 'unknown'} ${req.path || 'unknown'} (${req.status || 'no status'})`);
      pushRing(store.requests, req);
    } else if (kind === "logs") {
      const log = item as LogItem;
      console.log(`[STORE] 📝 Storing log: ${log.message.substring(0, 100)}... (service: ${log.service || 'unknown'})`);
      pushRing(store.logs, log);
    } else if (kind === "events") {
      const event = item as EventItem;
      console.log(`[STORE] 🎯 Storing event: ${event.name} (service: ${event.service || 'unknown'})`);
      pushRing(store.events, event);
    } else if (kind === "metrics") {
      const metric = item as MetricItem;
      console.log(`[STORE] 📈 Storing metric: ${metric.name} = ${metric.value ?? 'n/a'} ${metric.unit ?? ''} (kind: ${metric.kind ?? 'n/a'})`);
      pushRing(store.metrics, metric);
    } else if (kind === "raw") {
      const raw = item as RawItem;
      console.log(`[STORE] 📦 Storing raw data: ${raw.dataType} from ${raw.source || 'unknown'}`);
      pushRing(store.raw, raw);
    }
    
    const afterCounts = this.counts();
    console.log(`[STORE] 📊 Storage counts updated: ${kind} ${beforeCounts[kind]} → ${afterCounts[kind]} (total: ${Object.values(afterCounts).reduce((a, b) => a + b, 0)})`);
  },
  snapshot() {
    return {
      requests: snapshot(store.requests),
      logs: snapshot(store.logs),
      events: snapshot(store.events),
      metrics: snapshot(store.metrics),
      raw: snapshot(store.raw),
      cap: CAP,
    };
  },
  counts() {
    return {
      requests: store.requests.data.length,
      logs: store.logs.data.length,
      events: store.events.data.length,
      metrics: store.metrics.data.length,
      raw: store.raw.data.length,
      cap: CAP,
    };
  },
  clear() {
    // Clear all ring buffers
    const totalRemoved = store.requests.data.length + store.logs.data.length + 
                        store.events.data.length + store.metrics.data.length + store.raw.data.length;
    
    store.requests.data.length = 0;
    store.requests.idx = 0;
    store.logs.data.length = 0;
    store.logs.idx = 0;
    store.events.data.length = 0;
    store.events.idx = 0;
    store.metrics.data.length = 0;
    store.metrics.idx = 0;
    store.raw.data.length = 0;
    store.raw.idx = 0;
    
    return totalRemoved;
  },

  // Statistics functions compatible with legacy store.ts API
  getEventCounts(from: Date, to: Date, userId?: string | null): Array<{eventName: string, count: number}> {
    const fromMs = from.getTime();
    const toMs = to.getTime();
    const events = snapshot(store.events).filter(e => 
      e.t >= fromMs && e.t <= toMs && (!userId || e.attrs?.userId === userId)
    );
    
    const map = new Map<string, number>();
    for (const event of events) {
      map.set(event.name, (map.get(event.name) ?? 0) + 1);
    }
    
    return [...map.entries()].map(([eventName, count]) => ({ eventName, count }));
  },

  getTotalCount(from: Date, to: Date, userId?: string | null): number {
    const fromMs = from.getTime();
    const toMs = to.getTime();
    const events = snapshot(store.events).filter(e => 
      e.t >= fromMs && e.t <= toMs && (!userId || e.attrs?.userId === userId)
    );
    return events.length;
  },

  getStatistics(from: Date, to: Date, userId?: string | null): {
    totalEventCount: number;
    totalUniqueEvents: number;
    totalServices: number;
    perDay: Array<{date: string, count: number}>;
    topEvents: Array<{eventName: string, count: number}>;
    serviceBreakdown: Array<{
      serviceName: string;
      eventCount: number;
      uniqueEvents: number;
      lastSeen: string;
      topEvents: Array<{eventName: string, count: number}>;
    }>;
  } {
    const fromMs = from.getTime();
    const toMs = to.getTime();
    const events = snapshot(store.events).filter(e => 
      e.t >= fromMs && e.t <= toMs && (!userId || e.attrs?.userId === userId)
    );
    
    const totalEventCount = events.length;
    const eventNames = new Set(events.map(e => e.name));
    const totalUniqueEvents = eventNames.size;
    
    // Per-day aggregation
    const perDayMap = new Map<string, number>();
    const byService = new Map<string, EventItem[]>();
    
    for (const event of events) {
      const d = new Date(event.t);
      const dateKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
      perDayMap.set(dateKey, (perDayMap.get(dateKey) ?? 0) + 1);
      
      const serviceName = event.service ?? 'unknown';
      if (!byService.has(serviceName)) byService.set(serviceName, []);
      byService.get(serviceName)!.push(event);
    }
    
    const perDay = [...perDayMap.entries()]
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => (a.date < b.date ? -1 : 1));
    
    // Top events
    const eventCounts = this.getEventCounts(from, to, userId);
    const topEvents = eventCounts
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    // Service breakdown
    const serviceBreakdown = [...byService.entries()].map(([serviceName, serviceEvents]) => {
      const serviceEventNames = new Set(serviceEvents.map(e => e.name));
      const lastSeenTs = Math.max(...serviceEvents.map(e => e.t));
      
      const serviceEventCounts = new Map<string, number>();
      for (const event of serviceEvents) {
        serviceEventCounts.set(event.name, (serviceEventCounts.get(event.name) ?? 0) + 1);
      }
      
      const topEvents = [...serviceEventCounts.entries()]
        .map(([eventName, count]) => ({ eventName, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      
      return {
        serviceName,
        eventCount: serviceEvents.length,
        uniqueEvents: serviceEventNames.size,
        lastSeen: new Date(lastSeenTs).toISOString(),
        topEvents,
      };
    });
    
    const totalServices = byService.size;
    
    return {
      totalEventCount,
      totalUniqueEvents,
      totalServices,
      perDay,
      topEvents,
      serviceBreakdown,
    };
  },

  getHistory(userId: string, from?: Date | null, to?: Date | null, limit = 100): Array<{
    id: string;
    name: string;
    timestamp: string;
    userId?: string;
    userAgent?: string;
    referrer?: string;
  }> {
    const events = snapshot(store.events)
      .filter(e => e.attrs?.userId === userId)
      .filter(e => !from || e.t >= from.getTime())
      .filter(e => !to || e.t <= to.getTime())
      .sort((a, b) => b.t - a.t)
      .slice(0, limit);
    
    return events.map(event => ({
      id: event.attrs?.id as string || `event-${event.t}`,
      name: event.name,
      timestamp: new Date(event.t).toISOString(),
      userId: event.attrs?.userId as string,
      userAgent: event.attrs?.userAgent as string,
      referrer: event.attrs?.referrer as string,
    }));
  },

  trackEvent(eventName: string, payload: AIEventPayload = {}, userId?: string | null): TrackEventResponse {
    const id = uuid();
    const timestamp = Date.now();
    
    // Store as EventItem in events ring buffer
    const eventItem: EventItem = {
      t: timestamp,
      service: payload.serviceName || 'unknown',
      name: eventName,
      attrs: {
        id,
        userId,
        userAgent: payload.userAgent,
        referrer: payload.referrer,
        sessionId: payload.sessionId,
        userRole: payload.userRole,
        correlationId: payload.correlationId,
        statusCode: payload.statusCode,
        responseTimeMs: payload.responseTimeMs,
        metadata: payload.metadata,
        ...payload,
      },
      raw: payload,
    };
    
    this.push('events', eventItem);
    
    // Generate suggestions (simple demo implementation)
    const suggestions: AISuggestion[] = [
      {
        id: uuid(),
        title: `Consider grouping event '${eventName}'`,
        description: "Auto suggestion from demo engine",
        score: 0.3,
      },
    ];

    const response = {
      success: true,
      message: "Tracked",
      suggestions,
      eventId: id,
      timestamp: new Date(timestamp).toISOString(),
    };

    // Broadcast the event to connected clients
    broadcast({ type: "event", data: eventItem });
    
    return response;
  },

  trackEventsBatch(events: Array<{eventName: string, payload?: AIEventPayload}>, userId?: string | null): TrackEventResponse[] {
    return events.map(({eventName, payload}) => 
      this.trackEvent(eventName, payload, userId)
    );
  },

  getSuggestions(): AISuggestion[] {
    // Example: suggest top events in recent window
    const recent = new Date(Date.now() - 24 * 60 * 60 * 1000); // last 24h
    const counts = this.getEventCounts(recent, new Date()).slice(0, 3);
    
    return [
      {
        id: uuid(),
        title: "Popular Events",
        description: `Top events: ${counts.map(c => c.eventName).join(', ')}`,
        score: 0.8,
        tags: ["analytics", "insights"],
      },
      {
        id: uuid(),
        title: "Event Tracking Health",
        description: `${this.counts().events} events stored across ${new Set(snapshot(store.events).map(e => e.service)).size} services`,
        score: 0.6,
        tags: ["monitoring", "health"],
      },
    ];
  },

  getUniqueEventNames(from: Date, to: Date, userId?: string | null): string[] {
    const fromMs = from.getTime();
    const toMs = to.getTime();
    const events = snapshot(store.events).filter(e => 
      e.t >= fromMs && e.t <= toMs && (!userId || e.attrs?.userId === userId)
    );
    
    const set = new Set<string>();
    for (const event of events) {
      set.add(event.name);
    }
    return [...set];
  },

  getAnalytics(from: Date, to: Date, eventPattern?: string | null, userId?: string | null): Array<{
    eventName: string;
    count: number;
    firstSeen: string;
    lastSeen: string;
  }> {
    const fromMs = from.getTime();
    const toMs = to.getTime();
    const events = snapshot(store.events).filter(e => 
      e.t >= fromMs && e.t <= toMs && 
      (!userId || e.attrs?.userId === userId) &&
      (!eventPattern || e.name.toLowerCase().includes(eventPattern.toLowerCase()))
    );
    
    const byName = new Map<string, EventItem[]>();
    for (const event of events) {
      const arr = byName.get(event.name) ?? [];
      arr.push(event);
      byName.set(event.name, arr);
    }
    
    return [...byName.entries()].map(([eventName, events]) => ({
      eventName,
      count: events.length,
      firstSeen: new Date(Math.min(...events.map(e => e.t))).toISOString(),
      lastSeen: new Date(Math.max(...events.map(e => e.t))).toISOString(),
    }));
  },

  // SSE client registration
  registerSSEClient(send: SSESend): () => void {
    const clientId = Math.random().toString(36).substr(2, 9);
    console.log(`[ingestStore] ➕ Registering SSE client ${clientId}, total clients:`, sseClients.size + 1);
    
    sseClients.add(send);
    
    // Send initial ping
    try {
      send(`event: ping\ndata: {"t":${Date.now()}}\n\n`);
    } catch {
      // ignore
    }
    
    return () => {
      console.log(`[ingestStore] ➖ Unregistering SSE client ${clientId}`);
      sseClients.delete(send);
    };
  },

  // WebSocket client registration
  registerWSClient(ws: WSLike): () => void {
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
  },
};
