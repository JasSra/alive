"use client";
import { useMemo } from "react";

export type LiveStoredEvent = {
  id: string;
  name: string;
  timestamp: number; // epoch ms
  payload?: {
    correlationId?: string;
    statusCode?: number;
    responseTimeMs?: number;
  };
};

export type LiveEnvelope = { type?: string; data?: LiveStoredEvent };

export type RangeEvt = {
  id: string;
  name: string;
  timestamp: string; // ISO
  correlationId?: string;
  statusCode?: number;
  responseTimeMs?: number;
  userId?: string;
  serviceName?: string;
  requestPath?: string;
};

export type CorrelatedItem = {
  id: string;
  correlationId?: string;
  name: string;
  requestAt?: number; // epoch ms
  responseAt?: number; // epoch ms
  statusCode?: number;
  latencyMs?: number;
  pending: boolean;
  userId?: string;
  serviceName?: string;
  requestPath?: string;
};

function asStoredFromLive(live: unknown): LiveStoredEvent | null {
  const env = live as LiveEnvelope | undefined;
  const d = env?.data as LiveStoredEvent | undefined;
  if (!d || typeof d !== "object" || typeof d.name !== "string") return null;
  return d;
}

export function useCorrelation(liveEvents: Array<{ data?: unknown; t?: number }>, rangeEvents: RangeEvt[], useLive: boolean) {
  return useMemo<CorrelatedItem[]>(() => {
    const map = new Map<string, CorrelatedItem>();

    const add = (
      idKey: string,
      name: string,
      corr?: string,
      t?: number,
      statusCode?: number,
      responseTimeMs?: number,
      userId?: string,
      serviceName?: string,
      requestPath?: string,
    ) => {
      const key = corr || idKey;
      const existing = map.get(key);
      const isResponse = typeof statusCode === "number" && statusCode > 0 || typeof responseTimeMs === "number";
      const isRequest = typeof statusCode === "number" && statusCode === 0;
      const next: CorrelatedItem = existing ?? {
        id: key,
        correlationId: corr,
        name,
        pending: true,
        userId,
        serviceName,
        requestPath,
      };
      if (isRequest) {
        next.requestAt = t ?? next.requestAt;
      }
      if (isResponse) {
        next.responseAt = t ?? next.responseAt;
        next.statusCode = statusCode;
        if (!next.latencyMs && typeof responseTimeMs === "number") next.latencyMs = responseTimeMs;
      }
      // If we have both, compute latency if missing
      if (next.requestAt && next.responseAt && !next.latencyMs) {
        next.latencyMs = Math.max(0, next.responseAt - next.requestAt);
      }
      next.pending = !(next.requestAt && next.responseAt);
  // Enrich context fields if provided and missing
  if (userId && !next.userId) next.userId = userId;
  if (serviceName && !next.serviceName) next.serviceName = serviceName;
  if (requestPath && !next.requestPath) next.requestPath = requestPath;
  map.set(key, next);
    };

    if (useLive) {
      for (const e of liveEvents) {
        const s = asStoredFromLive(e?.data);
        if (!s) continue;
        const corr = s.payload?.correlationId;
        const t = s.timestamp ?? e.t ?? Date.now();
        add(
          s.id,
          s.name,
          corr,
          t,
          s.payload?.statusCode,
          s.payload?.responseTimeMs,
          undefined,
          undefined,
          undefined,
        );
      }
    } else {
      for (const r of rangeEvents) {
        const t = Date.parse(r.timestamp);
        add(
          r.id,
          r.name,
          r.correlationId,
          t,
          r.statusCode,
          r.responseTimeMs,
          r.userId,
          r.serviceName,
          r.requestPath,
        );
      }
    }

    // Sort by last activity
    return [...map.values()].sort((a, b) => {
      const at = a.responseAt ?? a.requestAt ?? 0;
      const bt = b.responseAt ?? b.requestAt ?? 0;
      return bt - at;
    });
  }, [liveEvents, rangeEvents, useLive]);
}
