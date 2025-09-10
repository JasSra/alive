import { BaseMessage } from "../types";

function uuid() {
  const g = globalThis as unknown as { crypto?: { randomUUID?: () => string } };
  if (typeof g.crypto?.randomUUID === "function") return g.crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const isObj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object";
const get = (o: unknown, k: string): unknown => (isObj(o) ? o[k] : undefined);

// Accepts generic OTLP-like envelope
// Example bodies supported:
// { timestamp: 1712345678901, body: "message", attributes: { service.name: "api" }, traceId, spanId, severityNumber }
// { resource: { attributes: [...] }, logRecord: { timeUnixNano, body, attributes, severityNumber, traceId, spanId } }
export function parseOtlp(input: unknown, extra?: Partial<BaseMessage>): BaseMessage {
  const now = Date.now();
  const id = extra?.id ?? uuid();
  let ts = now;
  let message = "";
  let severity: number | undefined;
  let traceId: string | undefined;
  let spanId: string | undefined;
  const attributes: Record<string, unknown> = { ...(extra?.attributes ?? {}) };

  const obj = input;
  if (obj && isObj(obj)) {
    // flat style
    const flatTimestamp = get(obj, "timestamp");
    if (typeof flatTimestamp === "number") ts = flatTimestamp;
    const flatBody = get(obj, "body");
    if (typeof flatBody === "string") message = flatBody;
    const flatMsg = get(obj, "message");
    if (typeof flatMsg === "string" && !message) message = flatMsg;
    const flatSev = get(obj, "severityNumber");
    if (typeof flatSev === "number") severity = flatSev;
    const flatTrace = get(obj, "traceId");
    if (typeof flatTrace === "string") traceId = flatTrace;
    const flatSpan = get(obj, "spanId");
    if (typeof flatSpan === "string") spanId = flatSpan;
    const flatAttrs = get(obj, "attributes");
    if (isObj(flatAttrs)) Object.assign(attributes, flatAttrs as Record<string, unknown>);
    // resource nested style
    const resource = get(obj, "resource");
    const resAttrs = isObj(resource) ? resource["attributes"] : undefined;
    if (Array.isArray(resAttrs)) {
      for (const a of resAttrs as unknown[]) {
        if (isObj(a) && typeof a.key === "string" && isObj(a.value)) {
          const v = a.value as Record<string, unknown>;
          attributes[a.key] = v.stringValue ?? v.intValue ?? v.doubleValue ?? v.boolValue ?? v;
        }
      }
    }
    const logRecord = get(obj, "logRecord");
    if (isObj(logRecord)) {
      const lr = logRecord as Record<string, unknown>;
      if (typeof lr.timeUnixNano === "string") {
        const n = Number(lr.timeUnixNano as string);
        if (!Number.isNaN(n)) ts = Math.floor(n / 1_000_000); // ns -> ms
      }
      if (isObj(lr.body) && typeof (lr.body as Record<string, unknown>).stringValue === "string") message = (lr.body as Record<string, unknown>).stringValue as string;
      if (typeof lr.severityNumber === "number") severity = lr.severityNumber as number;
      if (typeof lr.traceId === "string") traceId = lr.traceId as string;
      if (typeof lr.spanId === "string") spanId = lr.spanId as string;
      if (Array.isArray(lr.attributes)) {
        for (const a of lr.attributes as unknown[]) {
          if (isObj(a) && typeof a.key === "string" && isObj(a.value)) {
            const v = a.value as Record<string, unknown>;
            attributes[a.key] = v.stringValue ?? v.intValue ?? v.doubleValue ?? v.boolValue ?? v;
          }
        }
      }
    }
  }

  // Try service.name from attributes
  const svcName = extra?.serviceName ?? (attributes["service.name"] as string | undefined) ?? (attributes["serviceName"] as string | undefined);

  return {
    id,
    ts,
    source: "otlp",
    message,
  serviceName: svcName,
  severity,
  traceId: extra?.traceId ?? traceId,
  spanId: extra?.spanId ?? spanId,
    correlationId: extra?.correlationId,
    attributes: { ...attributes, parser: "otlp" },
    raw: input,
  };
}
