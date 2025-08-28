import type { AIEventPayload, BatchTrackEventRequest } from "./types";

export async function postEvent(eventName: string, payload?: AIEventPayload, userId?: string) {
  const res = await fetch(`/api/events/track/${encodeURIComponent(eventName)}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(userId ? { "x-user-id": userId } : {}),
    },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function postBatch(body: BatchTrackEventRequest, userId?: string) {
  const res = await fetch(`/api/events/track/batch`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(userId ? { "x-user-id": userId } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export function openEventStream(onMessage: (data: unknown) => void, onStatus?: (s: "connecting" | "open" | "error") => void) {
  const es = new EventSource("/api/events/stream");
  onStatus?.("connecting");
  es.onopen = () => onStatus?.("open");
  es.onerror = () => onStatus?.("error");
  es.onmessage = (e) => {
    try {
      onMessage(JSON.parse(e.data));
    } catch {
      // ignore bad JSON
    }
  };
  return () => es.close();
}

// Helpers for analytics endpoints (for charts)
export async function getStatistics(params: { from: string; to: string; userScope?: "current" | "all" }) {
  const url = new URL("/api/events/statistics", window.location.origin);
  url.searchParams.set("from", params.from);
  url.searchParams.set("to", params.to);
  if (params.userScope) url.searchParams.set("userScope", params.userScope);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function getEventCountsApi(params: { from: string; to: string; userScope?: "current" | "all"; orderBy?: "most" | "least"; limit?: number }) {
  const url = new URL("/api/events/events/counts", window.location.origin);
  url.searchParams.set("from", params.from);
  url.searchParams.set("to", params.to);
  if (params.userScope) url.searchParams.set("userScope", params.userScope);
  if (params.orderBy) url.searchParams.set("orderBy", params.orderBy);
  if (params.limit) url.searchParams.set("limit", String(params.limit));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function getRangeEvents(params: { from: string; to: string; userScope?: "current" | "all"; limit?: number }) {
  const url = new URL("/api/events/range", window.location.origin);
  url.searchParams.set("from", params.from);
  url.searchParams.set("to", params.to);
  if (params.userScope) url.searchParams.set("userScope", params.userScope);
  if (params.limit) url.searchParams.set("limit", String(params.limit));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export interface ServerMetrics {
  memory: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
    arrayBuffers: number;
    rssMB: number;
    heapUsedMB: number;
    heapTotalMB: number;
  };
  eventsLast5m: number;
  uptimeSec: number;
  pid: number;
  timestamp: number; // epoch ms
}

export async function getMetrics(): Promise<ServerMetrics> {
  const res = await fetch(`/api/events/metrics`, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

