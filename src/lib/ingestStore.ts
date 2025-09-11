// Simple in-memory ring buffers for unified ingest (requests, logs, events)
// Capacity is config driven via env or defaults to 2000 items each

export type IngestKind = "requests" | "logs" | "events" | "raw";

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
    raw: Ring<RawItem>;
  };
};

const CAP = Number(process.env.UNIFIED_INGEST_CAP || 2000);

if (!globalStore.__unifiedIngest) {
  globalStore.__unifiedIngest = {
    requests: createRing<RequestItem>(CAP),
    logs: createRing<LogItem>(CAP),
    events: createRing<EventItem>(CAP),
    raw: createRing<RawItem>(CAP),
  };
}

const store = globalStore.__unifiedIngest!;

export const ingestStore = {
  push(kind: IngestKind, item: RequestItem | LogItem | EventItem | RawItem) {
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
      raw: snapshot(store.raw),
      cap: CAP,
    };
  },
  counts() {
    return {
      requests: store.requests.data.length,
      logs: store.logs.data.length,
      events: store.events.data.length,
      raw: store.raw.data.length,
      cap: CAP,
    };
  },
  clear() {
    // Clear all ring buffers
    const totalRemoved = store.requests.data.length + store.logs.data.length + 
                        store.events.data.length + store.raw.data.length;
    
    store.requests.data.length = 0;
    store.requests.idx = 0;
    store.logs.data.length = 0;
    store.logs.idx = 0;
    store.events.data.length = 0;
    store.events.idx = 0;
    store.raw.data.length = 0;
    store.raw.idx = 0;
    
    return totalRemoved;
  },
};
