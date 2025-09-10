import { parseSyslog } from "./parsers/syslog";
import { transformOtlpLogsToBase } from "./parsers/otlpAdapter";
import { ingestStore, type IngestKind, type RequestItem, type LogItem, type EventItem } from "./ingestStore";
import { publishUnifiedEvent, publishUnifiedLog, publishUnifiedRequest } from "./store";

// Heuristics to detect payload type
function looksLikeOtlp(obj: unknown): obj is { resourceLogs: Array<{ scopeLogs?: unknown[] }> } {
  if (!obj || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  const rl = o.resourceLogs as unknown;
  if (!Array.isArray(rl)) return false;
  return rl.length === 0 || typeof rl[0] === "object";
}

function isProbablySyslogText(text: string): boolean {
  // crude: RFC 3164/5424 typically starts with pri/timestamp/host
  return /<\d+>\d?\s|\w{3}\s+\d{1,2}\s\d{2}:\d{2}:\d{2}/.test(text);
}

export type UnifiedResult = { success: true; written: number; byKind: Record<IngestKind, number> } | { success: false; message: string };

export async function unifiedIngest(input: unknown): Promise<UnifiedResult> {
  try {
    const byKind: Record<IngestKind, number> = { requests: 0, logs: 0, events: 0 };

    // Case 1: string body (could be syslog or plain text lines)
    if (typeof input === "string") {
      const lines = input.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      if (lines.length === 0) return { success: true, written: 0, byKind };
      for (const line of lines) {
        if (isProbablySyslogText(line)) {
          const m = parseSyslog(line);
          const li: LogItem = {
            t: m.ts,
            service: m.serviceName,
            severity: (m.severity as number | string | undefined) ?? (m.attributes?.severityNumber as number | undefined),
            message: m.message,
            attrs: m.attributes,
            raw: m.raw ?? line,
          };
          ingestStore.push("logs", li);
          // broadcast + buckets
          publishUnifiedLog({ t: li.t, service: li.service, severity: li.severity, message: li.message, attrs: li.attrs });
          byKind.logs++;
        } else {
          // plain text -> log
          const li: LogItem = { t: Date.now(), message: line };
          ingestStore.push("logs", li);
          publishUnifiedLog({ t: li.t, message: li.message });
          byKind.logs++;
        }
      }
      return { success: true, written: lines.length, byKind };
    }

    // Case 2: Buffer/ArrayBuffer (treat as text)
    if (input instanceof ArrayBuffer || ArrayBuffer.isView(input)) {
      const source = input instanceof ArrayBuffer ? input : (input as ArrayBufferView).buffer;
      const text = new TextDecoder().decode(source);
      return unifiedIngest(text);
    }

    // Case 3: JSON
    if (typeof input === "object" && input) {
      const obj = input as Record<string, unknown> | unknown[];
      // 3a: OTLP logs
      if (looksLikeOtlp(obj)) {
        const base = await transformOtlpLogsToBase(obj);
  for (const m of base) {
          // heuristic classification: requests vs logs vs events
      const a = (m.attributes || {}) as Record<string, unknown>;
          if (a.url || a.status || a.duration_ms || a.responseTimeMs) {
            const req: RequestItem = {
              t: m.ts,
              service: m.serviceName,
              method: (a.method as string) || undefined,
              path: (a.url as string) || (a.path as string) || undefined,
              status: (a.status as number) || (a.statusCode as number) || undefined,
              duration_ms: (a.duration_ms as number) || (a.responseTimeMs as number) || undefined,
              attrs: m.attributes,
              raw: m.raw,
            };
            ingestStore.push("requests", req);
            publishUnifiedRequest(req);
            byKind.requests++;
          } else if (m.message || m.severity !== undefined) {
            const log: LogItem = {
              t: m.ts,
              service: m.serviceName,
        severity: m.severity,
              message: m.message || String(m.raw ?? ""),
              attrs: m.attributes,
              raw: m.raw,
            };
            ingestStore.push("logs", log);
            publishUnifiedLog({ t: log.t, service: log.service, severity: log.severity, message: log.message, attrs: log.attrs });
            byKind.logs++;
          } else {
            const ev: EventItem = { t: m.ts, service: m.serviceName, name: m.message || "event", attrs: m.attributes, raw: m.raw };
            ingestStore.push("events", ev);
            publishUnifiedEvent({ name: ev.name, timestamp: ev.t, payload: { serviceName: ev.service, metadata: ev.attrs } });
            byKind.events++;
          }
        }
        return { success: true, written: base.length, byKind };
      }

      // 3b: Structured generic JSON — try to map
      // If array -> treat each item as a log/event
      if (Array.isArray(obj)) {
        let count = 0;
        for (const it of obj as unknown[]) {
          const mapped = mapGeneric(it as Record<string, unknown>);
          ingestStore.push(mapped.kind, mapped.item);
          // publish
          if (mapped.kind === "requests") publishUnifiedRequest(mapped.item as RequestItem);
          else if (mapped.kind === "logs") {
            const li = mapped.item as LogItem;
            publishUnifiedLog({ t: li.t, service: li.service, severity: li.severity, message: li.message, attrs: li.attrs });
          } else {
            const ev = mapped.item as EventItem;
            publishUnifiedEvent({ name: ev.name, timestamp: ev.t, payload: { serviceName: ev.service, metadata: ev.attrs } });
          }
          byKind[mapped.kind]++;
          count++;
        }
        return { success: true, written: count, byKind };
      }

      // single object
  const mapped = mapGeneric(obj as Record<string, unknown>);
  ingestStore.push(mapped.kind, mapped.item);
      if (mapped.kind === "requests") publishUnifiedRequest(mapped.item as RequestItem);
      else if (mapped.kind === "logs") {
        const li = mapped.item as LogItem;
        publishUnifiedLog({ t: li.t, service: li.service, severity: li.severity, message: li.message, attrs: li.attrs });
      } else {
        const ev = mapped.item as EventItem;
        publishUnifiedEvent({ name: ev.name, timestamp: ev.t, payload: { serviceName: ev.service, metadata: ev.attrs } });
      }
      byKind[mapped.kind]++;
      return { success: true, written: 1, byKind };
    }

    return { success: false, message: "Unsupported payload" };
  } catch (e) {
    return { success: false, message: (e as Error).message };
  }
}

function mapGeneric(obj: Record<string, unknown> | string): { kind: IngestKind; item: RequestItem | LogItem | EventItem } {
  const t = Date.now();
  const get = (k: string) => (typeof obj === "object" ? (obj as Record<string, unknown>)[k] : undefined);
  const service = (get("service") || get("serviceName") || get("app")) as string | undefined;

  // request-ish
  if (typeof obj === "object" && (get("method") || get("path") || get("url") || get("status") || get("duration") || get("duration_ms") || get("responseTimeMs"))) {
    const item: RequestItem = {
      t,
      service,
      method: get("method") as string | undefined,
      path: (get("path") as string | undefined) || (get("url") as string | undefined),
      status: (get("status") as number | undefined) || (get("statusCode") as number | undefined),
      duration_ms: (get("duration_ms") as number | undefined) || (get("responseTimeMs") as number | undefined) || (get("duration") as number | undefined),
      attrs: obj as Record<string, unknown>,
      raw: obj as Record<string, unknown>,
    };
    return { kind: "requests", item };
  }

  // log-ish
  if ((typeof obj === "object" && (get("message") || get("level") || get("severity"))) || typeof obj === "string") {
    const item: LogItem = {
      t,
      service,
  severity: (get("severity") as number | string | undefined) || (get("level") as number | string | undefined),
      message: (get("message") as string) || String(obj),
      attrs: typeof obj === "object" ? (obj as Record<string, unknown>) : undefined,
  raw: typeof obj === "object" ? (obj as Record<string, unknown>) : obj,
    };
    return { kind: "logs", item };
  }

  // fallback -> event
  const item: EventItem = {
    t,
    service,
  name: (get("event") as string) || (get("name") as string) || "event",
  attrs: typeof obj === "object" ? (obj as Record<string, unknown>) : undefined,
  raw: typeof obj === "object" ? (obj as Record<string, unknown>) : obj,
  };
  return { kind: "events", item };
}
