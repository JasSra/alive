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

// --- Unified ingest client helpers ---
export async function getIngestRecent(params: { kind: "logs" | "requests" | "events" | "metrics"; limit?: number }) {
  const url = new URL("/api/ingest/recent", window.location.origin);
  url.searchParams.set("kind", params.kind);
  if (params.limit) url.searchParams.set("limit", String(params.limit));
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function getIngestMetrics() {
  const res = await fetch(`/api/ingest/metrics`, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function getIngestHealth() {
  const res = await fetch(`/api/ingest/health`, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Request Analytics API
export interface RequestAnalytics {
  successRate: number;
  errorRate: number;
  totalRequests: number;
  totalErrors: number;
  latencyStats: {
    min: number;
    max: number;
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  };
  pathAnalytics: Array<{
    path: string;
    method: string;
    count: number;
    errorCount: number;
    successRate: number;
    errorRate: number;
    avgLatency: number;
    minLatency: number;
    maxLatency: number;
    errorCodes: Record<string, number>;
  }>;
  errorCodeDistribution: Record<string, number>;
  ipAddresses: Array<{
    ip: string;
    requestCount: number;
    errorCount: number;
    lastSeen: string;
  }>;
}

export async function getRequestAnalytics(params?: { hours?: number; limit?: number }): Promise<RequestAnalytics> {
  const url = new URL("/api/events/request-analytics", window.location.origin);
  if (params?.hours) url.searchParams.set("hours", String(params.hours));
  if (params?.limit) url.searchParams.set("limit", String(params.limit));
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

