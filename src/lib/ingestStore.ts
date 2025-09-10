// Simple in-memory ring buffers for unified ingest (requests, logs, events)
// Capacity is config driven via env or defaults to 2000 items each

export type IngestKind = "requests" | "logs" | "events";

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
  };
};

const CAP = Number(process.env.UNIFIED_INGEST_CAP || 2000);

if (!globalStore.__unifiedIngest) {
  globalStore.__unifiedIngest = {
    requests: createRing<RequestItem>(CAP),
    logs: createRing<LogItem>(CAP),
    events: createRing<EventItem>(CAP),
  };
}

const store = globalStore.__unifiedIngest!;

export const ingestStore = {
  push(kind: IngestKind, item: RequestItem | LogItem | EventItem) {
    if (kind === "requests") pushRing(store.requests, item as RequestItem);
    else if (kind === "logs") pushRing(store.logs, item as LogItem);
    else pushRing(store.events, item as EventItem);
  },
  snapshot() {
    return {
      requests: snapshot(store.requests),
      logs: snapshot(store.logs),
      events: snapshot(store.events),
      cap: CAP,
    };
  },
  counts() {
    return {
      requests: store.requests.data.length,
      logs: store.logs.data.length,
      events: store.events.data.length,
      cap: CAP,
    };
  },
};
