import { parseSyslog } from "./parsers/syslog";
import { transformOtlpLogsToBase } from "./parsers/otlpAdapter";
import { ingestStore, type IngestKind, type RequestItem, type LogItem, type EventItem, type RawItem, type MetricItem } from "./ingestStore";
import { publishUnifiedEvent, publishUnifiedLog, publishUnifiedRequest } from "./store";

// Heuristics to detect payload type
function looksLikeOtlp(obj: unknown): boolean {
  if (!obj || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  const rl = o["resourceLogs"] as unknown;
  const rs = o["resourceSpans"] as unknown;
  const rm = o["resourceMetrics"] as unknown;
  const isArrObj = (x: unknown) => Array.isArray(x) && (x.length === 0 || typeof x[0] === "object");
  return isArrObj(rl) || isArrObj(rs) || isArrObj(rm);
}

function isProbablySyslogText(text: string): boolean {
  // crude: RFC 3164/5424 typically starts with pri/timestamp/host
  return /<\d+>\d?\s|\w{3}\s+\d{1,2}\s\d{2}:\d{2}:\d{2}/.test(text);
}

export type UnifiedResult = { success: true; written: number; byKind: Record<IngestKind, number> } | { success: false; message: string };

export async function unifiedIngest(input: unknown): Promise<UnifiedResult> {
  const ingestId = Math.random().toString(36).substr(2, 9);
  const startTime = Date.now();
  
  console.log(`[UNIFIED:${ingestId}] 🔍 Starting unified ingestion, input type: ${typeof input}`);
  
  try {
  const byKind: Record<IngestKind, number> = { requests: 0, logs: 0, events: 0, metrics: 0, raw: 0 };

    // Case 1: string body (could be syslog or plain text lines)
    if (typeof input === "string") {
      console.log(`[UNIFIED:${ingestId}] 📝 Processing string input (${input.length} chars)`);
      const lines = input.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      console.log(`[UNIFIED:${ingestId}] 📋 Split into ${lines.length} lines`);
      
      if (lines.length === 0) {
        console.log(`[UNIFIED:${ingestId}] ⚠️ No non-empty lines found`);
        return { success: true, written: 0, byKind };
      }
      
      for (const line of lines) {
        if (isProbablySyslogText(line)) {
          console.log(`[UNIFIED:${ingestId}] 🗒️ Detected syslog format: ${line.substring(0, 50)}...`);
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
          console.log(`[UNIFIED:${ingestId}] 📄 Processing as plain text log: ${line.substring(0, 50)}...`);
          // plain text -> log
          const li: LogItem = { t: Date.now(), message: line };
          ingestStore.push("logs", li);
          publishUnifiedLog({ t: li.t, message: li.message });
          byKind.logs++;
        }
      }
      
      const duration = Date.now() - startTime;
      console.log(`[UNIFIED:${ingestId}] ✅ String processing completed in ${duration}ms:`, byKind);
      return { success: true, written: lines.length, byKind };
    }

    // Case 2: Buffer/ArrayBuffer (treat as text)
    if (input instanceof ArrayBuffer || ArrayBuffer.isView(input)) {
      console.log(`[UNIFIED:${ingestId}] 🔢 Processing binary data, converting to text`);
      const source = input instanceof ArrayBuffer ? input : (input as ArrayBufferView).buffer;
      const text = new TextDecoder().decode(source);
      console.log(`[UNIFIED:${ingestId}] 🔄 Recursively processing decoded text (${text.length} chars)`);
      return unifiedIngest(text);
    }

    // Case 3: JSON
    if (typeof input === "object" && input) {
      const obj = input as Record<string, unknown> | unknown[];
      console.log(`[UNIFIED:${ingestId}] 📦 Processing JSON object, isArray: ${Array.isArray(obj)}`);
      
      // 3a: OTLP logs
      if (looksLikeOtlp(obj)) {
        console.log(`[UNIFIED:${ingestId}] 🔌 Detected OTLP format`);
        const base = await transformOtlpLogsToBase(obj);
        console.log(`[UNIFIED:${ingestId}] 📊 Transformed OTLP to ${base.length} base items`);
        
  for (const m of base) {
          // heuristic classification: requests vs logs vs events
      const a = (m.attributes || {}) as Record<string, unknown>;
          // First, detect OTLP metrics promoted to base messages (metric.* attributes)
          if (a["metric.name"]) {
            const metric: MetricItem = {
              t: m.ts,
              service: m.serviceName,
              name: String(a["metric.name"] ?? "metric"),
              value: (typeof a["metric.value"] === "number" || typeof a["metric.value"] === "string") ? (a["metric.value"] as number | string) : undefined,
              unit: typeof a["metric.unit"] === "string" ? (a["metric.unit"] as string) : undefined,
              kind: typeof a["metric.kind"] === "string" ? (a["metric.kind"] as string) : undefined,
              attrs: m.attributes,
              raw: m.raw,
            };
            ingestStore.push("metrics", metric);
            byKind.metrics++;
            continue;
          }
          // Fallback: manual OTLP metric extraction emits body like "metric: <name>"
          // In case attributes were lost upstream, detect by message prefix
          if (typeof m.message === "string" && m.message.startsWith("metric:")) {
            const name = m.message.slice("metric:".length).trim() || "metric";
            const metric: MetricItem = {
              t: m.ts,
              service: m.serviceName,
              name,
              value: (typeof a["metric.value"] === "number" || typeof a["metric.value"] === "string") ? (a["metric.value"] as number | string) : undefined,
              unit: typeof a["metric.unit"] === "string" ? (a["metric.unit"] as string) : undefined,
              kind: typeof a["metric.kind"] === "string" ? (a["metric.kind"] as string) : undefined,
              attrs: m.attributes,
              raw: m.raw,
            };
            ingestStore.push("metrics", metric);
            byKind.metrics++;
            continue;
          }
          if (a.url || a.status || a.duration_ms || a.responseTimeMs) {
            console.log(`[UNIFIED:${ingestId}] 🌐 Classified as request: ${a.method || 'unknown'} ${a.url || a.path || 'unknown'}`);
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
            console.log(`[UNIFIED:${ingestId}] 📝 Classified as log: ${m.message || 'no message'} (severity: ${m.severity})`);
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
            console.log(`[UNIFIED:${ingestId}] 🎯 Classified as event: ${m.message || 'event'}`);
            const ev: EventItem = { t: m.ts, service: m.serviceName, name: m.message || "event", attrs: m.attributes, raw: m.raw };
            ingestStore.push("events", ev);
            publishUnifiedEvent({ name: ev.name, timestamp: ev.t, payload: { serviceName: ev.service, metadata: ev.attrs } });
            byKind.events++;
          }
        }
        
        const duration = Date.now() - startTime;
        console.log(`[UNIFIED:${ingestId}] ✅ OTLP processing completed in ${duration}ms:`, byKind);
        return { success: true, written: base.length, byKind };
      }

      // 3b: Structured generic JSON — try to map
      // If array -> treat each item as a log/event
      if (Array.isArray(obj)) {
        console.log(`[UNIFIED:${ingestId}] 📋 Processing array with ${obj.length} items`);
        let count = 0;
        for (const it of obj as unknown[]) {
          const mapped = mapGeneric(it as Record<string, unknown>);
          console.log(`[UNIFIED:${ingestId}] 📄 Item ${count + 1}/${obj.length} classified as: ${mapped.kind}`);
          ingestStore.push(mapped.kind, mapped.item);
          // publish
          if (mapped.kind === "requests") publishUnifiedRequest(mapped.item as RequestItem);
          else if (mapped.kind === "logs") {
            const li = mapped.item as LogItem;
            publishUnifiedLog({ t: li.t, service: li.service, severity: li.severity, message: li.message, attrs: li.attrs });
          } else if (mapped.kind === "events") {
            const ev = mapped.item as EventItem;
            publishUnifiedEvent({ name: ev.name, timestamp: ev.t, payload: { serviceName: ev.service, metadata: ev.attrs } });
          } else if (mapped.kind === "raw") {
            const raw = mapped.item as RawItem;
            publishUnifiedEvent({ 
              name: "raw_data", 
              timestamp: raw.t, 
              payload: { 
                serviceName: raw.service || 'unknown', 
                metadata: { 
                  dataType: raw.dataType, 
                  contentType: raw.contentType,
                  source: raw.source,
                  size: JSON.stringify(raw.content).length
                } 
              } 
            });
          }
          byKind[mapped.kind]++;
          count++;
        }
        
        const duration = Date.now() - startTime;
        console.log(`[UNIFIED:${ingestId}] ✅ Array processing completed in ${duration}ms:`, byKind);
        return { success: true, written: count, byKind };
      }

      // single object
      console.log(`[UNIFIED:${ingestId}] 📄 Processing single object`);
  const mapped = mapGeneric(obj as Record<string, unknown>);
  console.log(`[UNIFIED:${ingestId}] 🏷️ Single object classified as: ${mapped.kind}`);
  ingestStore.push(mapped.kind, mapped.item);
      if (mapped.kind === "requests") publishUnifiedRequest(mapped.item as RequestItem);
      else if (mapped.kind === "logs") {
        const li = mapped.item as LogItem;
        publishUnifiedLog({ t: li.t, service: li.service, severity: li.severity, message: li.message, attrs: li.attrs });
      } else if (mapped.kind === "events") {
        const ev = mapped.item as EventItem;
        publishUnifiedEvent({ name: ev.name, timestamp: ev.t, payload: { serviceName: ev.service, metadata: ev.attrs } });
      } else if (mapped.kind === "raw") {
        const raw = mapped.item as RawItem;
        publishUnifiedEvent({ 
          name: "raw_data", 
          timestamp: raw.t, 
          payload: { 
            serviceName: raw.service || 'unknown', 
            metadata: { 
              dataType: raw.dataType, 
              contentType: raw.contentType,
              source: raw.source,
              size: JSON.stringify(raw.content).length
            } 
          } 
        });
      }
      byKind[mapped.kind]++;
      
      const duration = Date.now() - startTime;
      console.log(`[UNIFIED:${ingestId}] ✅ Single object processing completed in ${duration}ms:`, byKind);
      return { success: true, written: 1, byKind };
    }

    const duration = Date.now() - startTime;
    console.log(`[UNIFIED:${ingestId}] ❌ Unsupported payload type after ${duration}ms`);
    return { success: false, message: "Unsupported payload" };
  } catch (e) {
    const duration = Date.now() - startTime;
    console.error(`[UNIFIED:${ingestId}] ❌ Error during ingestion after ${duration}ms:`, e);
    return { success: false, message: (e as Error).message };
  }
}

function mapGeneric(obj: Record<string, unknown> | string): { kind: IngestKind; item: RequestItem | LogItem | EventItem | RawItem } {
  const t = Date.now();
  const get = (k: string) => (typeof obj === "object" ? (obj as Record<string, unknown>)[k] : undefined);
  const service = (get("service") || get("serviceName") || get("app")) as string | undefined;

  console.log(`[MAPPER] 🔍 Mapping object with keys: ${typeof obj === "object" ? Object.keys(obj as Record<string, unknown>).join(", ") : "string"}`);

  // request-ish
  if (typeof obj === "object" && (get("method") || get("path") || get("url") || get("status") || get("duration") || get("duration_ms") || get("responseTimeMs"))) {
    console.log(`[MAPPER] 🌐 Detected request pattern - method: ${get("method")}, path: ${get("path") || get("url")}, status: ${get("status")}`);
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
    console.log(`[MAPPER] 📝 Detected log pattern - message: ${typeof obj === "string" ? obj.substring(0, 50) : String(get("message")).substring(0, 50)}...`);
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

  // event-ish (has event/name field)
  if (typeof obj === "object" && (get("event") || get("name"))) {
    const eventName = (get("event") as string) || (get("name") as string) || "event";
    console.log(`[MAPPER] 🎯 Detected event pattern - name: ${eventName}`);
    const item: EventItem = {
      t,
      service,
    name: eventName,
    attrs: obj as Record<string, unknown>,
    raw: obj as Record<string, unknown>,
    };
    return { kind: "events", item };
  }

  // fallback -> raw data for anything else
  console.log(`[MAPPER] 📦 Fallback to raw data - type: ${typeof obj}`);
  const item: RawItem = {
    t,
    service,
    dataType: typeof obj,
    content: obj,
    source: service || 'unknown',
    contentType: typeof obj === 'object' ? 'application/json' : 'text/plain'
  };
  return { kind: "raw", item };
}
