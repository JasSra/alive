export type BaseMessage = {
  id: string;
  ts: number; // epoch ms
  source: "syslog" | "otlp";
  message: string;
  serviceName?: string;
  host?: string;
  app?: string;
  severity?: string | number;
  traceId?: string;
  spanId?: string;
  correlationId?: string;
  attributes?: Record<string, unknown>;
  raw?: unknown;
};

type ExportLogsRequest = unknown;

const isObj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object";

function uuid() {
  const g = globalThis as unknown as { crypto?: { randomUUID?: () => string } };
  return g.crypto?.randomUUID?.() ?? Math.random().toString(16).slice(2) + Date.now().toString(16);
}

type PartialRecord = {
  timeUnixNano?: string | number;
  body?: unknown;
  resource?: Record<string, unknown>;
  attributes?: Record<string, unknown>;
  severityNumber?: number;
  traceId?: string;
  spanId?: string;
};

function fromRecord(rec: PartialRecord): BaseMessage {
  const ts = typeof rec.timeUnixNano === "number"
    ? Math.floor(rec.timeUnixNano / 1_000_000)
    : typeof rec.timeUnixNano === "string" && !Number.isNaN(Number(rec.timeUnixNano))
      ? Math.floor(Number(rec.timeUnixNano) / 1_000_000)
      : Date.now();
  const attrs: Record<string, unknown> = {};
  if (rec.resource) for (const [k, v] of Object.entries(rec.resource)) attrs[k] = v as unknown;
  if (rec.attributes) for (const [k, v] of Object.entries(rec.attributes)) attrs[k] = v as unknown;
  let message = "";
  if (typeof rec.body === "string") message = rec.body;
  else if (isObj(rec.body) && typeof rec.body["stringValue"] === "string") message = rec.body["stringValue"] as string;
  const serviceName = (attrs["service.name"] as string) || (attrs["serviceName"] as string) || undefined;
  
  // Add HTTP request identification to attributes for proper classification
  if (attrs["http.url"] || attrs["url"] || attrs["http.method"] || attrs["method"]) {
    attrs["event_type"] = "request";
    attrs["statusCode"] = (attrs["statusCode"] as number) || (attrs["status"] as number) || (attrs["http.status_code"] as number) || undefined;
    attrs["responseTimeMs"] = (attrs["responseTimeMs"] as number) || (attrs["response_time_ms"] as number) || (attrs["duration_ms"] as number) || undefined;
    attrs["userAgent"] = (attrs["http.user_agent"] as string) || undefined;
    attrs["clientIp"] = (attrs["client.ip"] as string) || (attrs["ip"] as string) || undefined;
    attrs["method"] = (attrs["http.method"] as string) || (attrs["method"] as string) || undefined;
    attrs["url"] = (attrs["http.url"] as string) || (attrs["url"] as string) || undefined;
  } else if (rec.spanId || rec.traceId) {
    attrs["event_type"] = "span";
  } else {
    attrs["event_type"] = "log";
  }
  
  return {
    id: uuid(),
    ts,
    source: "otlp",
    message,
    serviceName,
    severity: typeof rec.severityNumber === "number" ? rec.severityNumber : undefined,
    traceId: rec.traceId,
    spanId: rec.spanId,
    correlationId: (attrs["correlation.id"] as string) || (attrs["correlationId"] as string) || undefined,
    attributes: attrs,
    raw: rec,
  };
}

function manualExtract(input: ExportLogsRequest): BaseMessage[] {
  const out: BaseMessage[] = [];
  if (!isObj(input)) return out;
  
  // Handle resourceLogs (log entries)
  const resourceLogs = (input as any)["resourceLogs"];
  if (Array.isArray(resourceLogs)) {
    for (const rl of resourceLogs) {
      const resourceAttrs: Record<string, unknown> = {};
      if (isObj(rl?.resource) && Array.isArray((rl.resource as any)["attributes"])) {
        for (const a of (rl.resource as any)["attributes"] as unknown[]) {
          if (isObj(a) && typeof (a as any).key === "string" && isObj((a as any).value)) {
            const v = (a as any).value as Record<string, unknown>;
            resourceAttrs[(a as any).key] = (v as any).stringValue ?? (v as any).intValue ?? (v as any).doubleValue ?? (v as any).boolValue ?? v;
          }
        }
      }
      const scopeLogs = (rl as any)["scopeLogs"];
      if (Array.isArray(scopeLogs)) {
        for (const sl of scopeLogs) {
          const logRecords = (sl as any)?.logRecords;
          if (Array.isArray(logRecords)) {
            for (const lr of logRecords) {
              const attrs: Record<string, unknown> = { ...resourceAttrs };
              const lrAttrs = isObj(lr) ? ((lr as any)["attributes"] as unknown) : undefined;
              if (Array.isArray(lrAttrs)) {
                for (const a of lrAttrs) {
                  if (isObj(a) && typeof (a as any).key === "string" && isObj((a as any).value)) {
                    const v = (a as any).value as Record<string, unknown>;
                    attrs[(a as any).key] = (v as any).stringValue ?? (v as any).intValue ?? (v as any).doubleValue ?? (v as any).boolValue ?? v;
                  }
                }
              }
              const timeUnixNano = isObj(lr) ? ((lr as any)["timeUnixNano"] as unknown) : undefined;
              const body = isObj(lr) ? ((lr as any)["body"] as unknown) : undefined;
              const severityNumber = isObj(lr) ? ((lr as any)["severityNumber"] as unknown) : undefined;
              const traceId = isObj(lr) ? ((lr as any)["traceId"] as unknown) : undefined;
              const spanId = isObj(lr) ? ((lr as any)["spanId"] as unknown) : undefined;
              out.push(
                fromRecord({
                  timeUnixNano: typeof timeUnixNano === "string" || typeof timeUnixNano === "number" ? timeUnixNano : undefined,
                  body,
                  severityNumber: typeof severityNumber === "number" ? (severityNumber as number) : undefined,
                  traceId: typeof traceId === "string" ? (traceId as string) : undefined,
                  spanId: typeof spanId === "string" ? (spanId as string) : undefined,
                  attributes: attrs,
                  resource: resourceAttrs,
                })
              );
            }
          }
        }
      }
    }
  }
  
  // Handle resourceSpans (trace spans - typically HTTP requests)
  const resourceSpans = (input as any)["resourceSpans"];
  if (Array.isArray(resourceSpans)) {
    for (const rs of resourceSpans) {
      const resourceAttrs: Record<string, unknown> = {};
      if (isObj(rs?.resource) && Array.isArray((rs.resource as any)["attributes"])) {
        for (const a of (rs.resource as any)["attributes"] as unknown[]) {
          if (isObj(a) && typeof (a as any).key === "string" && isObj((a as any).value)) {
            const v = (a as any).value as Record<string, unknown>;
            resourceAttrs[(a as any).key] = (v as any).stringValue ?? (v as any).intValue ?? (v as any).doubleValue ?? (v as any).boolValue ?? v;
          }
        }
      }
      const scopeSpans = (rs as any)["scopeSpans"];
      if (Array.isArray(scopeSpans)) {
        for (const ss of scopeSpans) {
          const spans = (ss as any)?.spans;
          if (Array.isArray(spans)) {
            for (const span of spans) {
              const attrs: Record<string, unknown> = { ...resourceAttrs };
              const spanAttrs = isObj(span) ? ((span as any)["attributes"] as unknown) : undefined;
              if (Array.isArray(spanAttrs)) {
                for (const a of spanAttrs) {
                  if (isObj(a) && typeof (a as any).key === "string" && isObj((a as any).value)) {
                    const v = (a as any).value as Record<string, unknown>;
                    attrs[(a as any).key] = (v as any).stringValue ?? (v as any).intValue ?? (v as any).doubleValue ?? (v as any).boolValue ?? v;
                  }
                }
              }
              
              // Extract span timing
              const startTimeUnixNano = isObj(span) ? ((span as any)["startTimeUnixNano"] as unknown) : undefined;
              const endTimeUnixNano = isObj(span) ? ((span as any)["endTimeUnixNano"] as unknown) : undefined;
              const timeUnixNano = startTimeUnixNano || endTimeUnixNano;
              
              // Calculate duration from span timing
              if (startTimeUnixNano && endTimeUnixNano) {
                const start = typeof startTimeUnixNano === "string" ? parseFloat(startTimeUnixNano) : startTimeUnixNano as number;
                const end = typeof endTimeUnixNano === "string" ? parseFloat(endTimeUnixNano) : endTimeUnixNano as number;
                attrs["duration_ms"] = Math.round((end - start) / 1_000_000); // Convert nanoseconds to milliseconds
              }
              
              // Map HTTP-specific attributes to standard names for request classification
              if (attrs["http.status_code"]) attrs["statusCode"] = attrs["http.status_code"];
              if (attrs["http.url"]) attrs["url"] = attrs["http.url"];
              if (attrs["http.method"]) attrs["method"] = attrs["http.method"];
              if (attrs["response_time_ms"]) attrs["responseTimeMs"] = attrs["response_time_ms"];
              
              const spanName = isObj(span) ? ((span as any)["name"] as unknown) : undefined;
              const traceId = isObj(span) ? ((span as any)["traceId"] as unknown) : undefined;
              const spanId = isObj(span) ? ((span as any)["spanId"] as unknown) : undefined;
              
              out.push(
                fromRecord({
                  timeUnixNano: typeof timeUnixNano === "string" || typeof timeUnixNano === "number" ? timeUnixNano : undefined,
                  body: typeof spanName === "string" ? `span: ${spanName}` : "span",
                  traceId: typeof traceId === "string" ? (traceId as string) : undefined,
                  spanId: typeof spanId === "string" ? (spanId as string) : undefined,
                  attributes: attrs,
                  resource: resourceAttrs,
                })
              );
            }
          }
        }
      }
    }
  }
  
  return out;
}

export async function transformOtlpLogsToBase(input: ExportLogsRequest): Promise<BaseMessage[]> {
  try {
    const mod = await import("@opentelemetry/otlp-transformer");
    const anyMod = mod as unknown as Record<string, unknown>;
    const logsNs = anyMod["logs"] as Record<string, unknown> | undefined;
    const createLogsIterable = (logsNs?.["createLogsIterable"] ?? anyMod["createLogsIterable"]) as
      | ((x: unknown) => Iterable<Record<string, unknown>>)
      | undefined;
    if (typeof createLogsIterable === "function") {
      const out: BaseMessage[] = [];
      for (const rec of createLogsIterable(input)) {
        const r = isObj(rec) ? (rec as Record<string, unknown>) : {};
        const msg = fromRecord({
          timeUnixNano: ((): string | number | undefined => {
            const v = (r as any)["timeUnixNano"];
            return typeof v === "string" || typeof v === "number" ? v : undefined;
          })(),
          body: (r as any)["body"],
          resource: isObj((r as any)["resource"]) ? ((r as any)["resource"] as Record<string, unknown>) : undefined,
          attributes: isObj((r as any)["attributes"]) ? ((r as any)["attributes"] as Record<string, unknown>) : undefined,
          severityNumber: typeof (r as any)["severityNumber"] === "number" ? ((r as any)["severityNumber"] as number) : undefined,
          traceId: typeof (r as any)["traceId"] === "string" ? ((r as any)["traceId"] as string) : undefined,
          spanId: typeof (r as any)["spanId"] === "string" ? ((r as any)["spanId"] as string) : undefined,
        });
        msg.attributes = { ...(msg.attributes ?? {}), parser: "otlp-transformer" };
        msg.raw = input;
        out.push(msg);
      }
      if (out.length) return out;
    }
  } catch {
    // ignore and fallback
  }
  return manualExtract(input);
}
