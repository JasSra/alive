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

// Safe property reader that avoids `any` usage
const read = (obj: unknown, key: string): unknown => (isObj(obj) ? obj[key] : undefined);

// Enhanced correlation ID extraction from multiple OTLP sources
function extractCorrelationId(attrs: Record<string, unknown>, rec: PartialRecord): string | undefined {
  // Priority order for correlation ID extraction:
  // 1. Explicit correlation IDs
  const explicit = (attrs["correlation.id"] as string) || 
                   (attrs["correlationId"] as string) || 
                   (attrs["correlation_id"] as string) ||
                   (attrs["x-correlation-id"] as string);
  if (explicit) return explicit;
  
  // 2. Trace ID as fallback for distributed tracing
  if (rec.traceId) return `trace:${rec.traceId}`;
  
  // 3. Session IDs for user correlation
  const session = (attrs["session.id"] as string) || 
                  (attrs["sessionId"] as string) ||
                  (attrs["session_id"] as string);
  if (session) return `session:${session}`;
  
  // 4. Request ID for HTTP correlation
  const request = (attrs["request.id"] as string) || 
                  (attrs["requestId"] as string) ||
                  (attrs["http.request.id"] as string);
  if (request) return `request:${request}`;
  
  // 5. User ID for user-based correlation
  const user = (attrs["user.id"] as string) || 
               (attrs["userId"] as string) ||
               (attrs["user_id"] as string);
  if (user) return `user:${user}`;
  
  return undefined;
}

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
  
  // Enhanced correlation ID extraction from multiple sources
  const correlationId = extractCorrelationId(attrs, rec);
  
  return {
    id: uuid(),
    ts,
    source: "otlp",
    message,
    serviceName,
    severity: typeof rec.severityNumber === "number" ? rec.severityNumber : undefined,
    traceId: rec.traceId,
    spanId: rec.spanId,
    correlationId,
    attributes: attrs,
    raw: rec,
  };
}

function manualExtract(input: ExportLogsRequest): BaseMessage[] {
  const out: BaseMessage[] = [];
  if (!isObj(input)) return out;
  
  // Handle resourceLogs (log entries)
  const resourceLogs = read(input, "resourceLogs");
  if (Array.isArray(resourceLogs)) {
    for (const rl of resourceLogs) {
      const resourceAttrs: Record<string, unknown> = {};
      const rlResource = isObj(rl) ? read(rl, "resource") : undefined;
      const rlResAttrs = isObj(rlResource) ? read(rlResource, "attributes") : undefined;
      if (Array.isArray(rlResAttrs)) {
        for (const a of rlResAttrs) {
          if (isObj(a)) {
            const k = read(a, "key");
            const v = read(a, "value");
            if (typeof k === "string" && isObj(v)) {
              const sv = read(v, "stringValue");
              const iv = read(v, "intValue");
              const dv = read(v, "doubleValue");
              const bv = read(v, "boolValue");
              resourceAttrs[k] = sv ?? iv ?? dv ?? bv ?? v;
            }
          }
        }
      }
      const scopeLogs = isObj(rl) ? read(rl, "scopeLogs") : undefined;
      if (Array.isArray(scopeLogs)) {
        for (const sl of scopeLogs) {
          const logRecords = isObj(sl) ? read(sl, "logRecords") : undefined;
          if (Array.isArray(logRecords)) {
            for (const lr of logRecords) {
              const attrs: Record<string, unknown> = { ...resourceAttrs };
              const lrAttrs = isObj(lr) ? read(lr, "attributes") : undefined;
              if (Array.isArray(lrAttrs)) {
                for (const a of lrAttrs) {
                  if (isObj(a)) {
                    const k = read(a, "key");
                    const v = read(a, "value");
                    if (typeof k === "string" && isObj(v)) {
                      const sv = read(v, "stringValue");
                      const iv = read(v, "intValue");
                      const dv = read(v, "doubleValue");
                      const bv = read(v, "boolValue");
                      attrs[k] = sv ?? iv ?? dv ?? bv ?? v;
                    }
                  }
                }
              }
              const timeUnixNano = isObj(lr) ? read(lr, "timeUnixNano") : undefined;
              const body = isObj(lr) ? read(lr, "body") : undefined;
              const severityNumber = isObj(lr) ? read(lr, "severityNumber") : undefined;
              const traceId = isObj(lr) ? read(lr, "traceId") : undefined;
              const spanId = isObj(lr) ? read(lr, "spanId") : undefined;
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
  const resourceSpans = read(input, "resourceSpans");
  if (Array.isArray(resourceSpans)) {
    for (const rs of resourceSpans) {
      const resourceAttrs: Record<string, unknown> = {};
      const rsResource = isObj(rs) ? read(rs, "resource") : undefined;
      const rsResAttrs = isObj(rsResource) ? read(rsResource, "attributes") : undefined;
      if (Array.isArray(rsResAttrs)) {
        for (const a of rsResAttrs) {
          if (isObj(a)) {
            const k = read(a, "key");
            const v = read(a, "value");
            if (typeof k === "string" && isObj(v)) {
              const sv = read(v, "stringValue");
              const iv = read(v, "intValue");
              const dv = read(v, "doubleValue");
              const bv = read(v, "boolValue");
              resourceAttrs[k] = sv ?? iv ?? dv ?? bv ?? v;
            }
          }
        }
      }
      const scopeSpans = isObj(rs) ? read(rs, "scopeSpans") : undefined;
      if (Array.isArray(scopeSpans)) {
        for (const ss of scopeSpans) {
          const spans = isObj(ss) ? read(ss, "spans") : undefined;
          if (Array.isArray(spans)) {
            for (const span of spans) {
              const attrs: Record<string, unknown> = { ...resourceAttrs };
              const spanAttrs = isObj(span) ? read(span, "attributes") : undefined;
              if (Array.isArray(spanAttrs)) {
                for (const a of spanAttrs) {
                  if (isObj(a)) {
                    const k = read(a, "key");
                    const v = read(a, "value");
                    if (typeof k === "string" && isObj(v)) {
                      const sv = read(v, "stringValue");
                      const iv = read(v, "intValue");
                      const dv = read(v, "doubleValue");
                      const bv = read(v, "boolValue");
                      attrs[k] = sv ?? iv ?? dv ?? bv ?? v;
                    }
                  }
                }
              }
              
              // Extract span timing
              const startTimeUnixNano = isObj(span) ? read(span, "startTimeUnixNano") : undefined;
              const endTimeUnixNano = isObj(span) ? read(span, "endTimeUnixNano") : undefined;
              const timeUnixNano = startTimeUnixNano || endTimeUnixNano;
              
              // Calculate duration from span timing
              if (startTimeUnixNano && endTimeUnixNano) {
                const start = typeof startTimeUnixNano === "string" ? parseFloat(startTimeUnixNano) : (startTimeUnixNano as number);
                const end = typeof endTimeUnixNano === "string" ? parseFloat(endTimeUnixNano) : (endTimeUnixNano as number);
                attrs["duration_ms"] = Math.round((end - start) / 1_000_000); // Convert nanoseconds to milliseconds
              }
              
              // Map HTTP-specific attributes to standard names for request classification
              if (attrs["http.status_code"]) attrs["statusCode"] = attrs["http.status_code"];
              if (attrs["http.url"]) attrs["url"] = attrs["http.url"];
              if (attrs["http.method"]) attrs["method"] = attrs["http.method"];
              if (attrs["response_time_ms"]) attrs["responseTimeMs"] = attrs["response_time_ms"];
              
              const spanName = isObj(span) ? read(span, "name") : undefined;
              const traceId = isObj(span) ? read(span, "traceId") : undefined;
              const spanId = isObj(span) ? read(span, "spanId") : undefined;
              
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

  // Handle resourceMetrics (metrics -> convert datapoints to log-like messages)
  const resourceMetrics = read(input, "resourceMetrics");
  if (Array.isArray(resourceMetrics)) {
    for (const rm of resourceMetrics) {
      const resourceAttrs: Record<string, unknown> = {};
      const rmResource = isObj(rm) ? read(rm, "resource") : undefined;
      const rmResAttrs = isObj(rmResource) ? read(rmResource, "attributes") : undefined;
      if (Array.isArray(rmResAttrs)) {
        for (const a of rmResAttrs) {
          if (isObj(a)) {
            const k = read(a, "key");
            const v = read(a, "value");
            if (typeof k === "string" && isObj(v)) {
              const sv = read(v, "stringValue");
              const iv = read(v, "intValue");
              const dv = read(v, "doubleValue");
              const bv = read(v, "boolValue");
              resourceAttrs[k] = sv ?? iv ?? dv ?? bv ?? v;
            }
          }
        }
      }
      const scopeMetrics = isObj(rm) ? read(rm, "scopeMetrics") : undefined;
      if (Array.isArray(scopeMetrics)) {
        for (const sm of scopeMetrics) {
          const metrics = isObj(sm) ? read(sm, "metrics") : undefined;
          if (Array.isArray(metrics)) {
            for (const metric of metrics) {
              if (!isObj(metric)) continue;
              const name = read(metric, "name") as string | undefined;
              const description = read(metric, "description") as string | undefined;
              const unit = read(metric, "unit") as string | undefined;

              const emitDataPoints = (dps: unknown[], kind: string, valueKey: "asInt" | "asDouble" | "count" | "sum") => {
                for (const dp of dps) {
                  if (!isObj(dp)) continue;
                  const dpAttrs: Record<string, unknown> = { ...resourceAttrs };
                  const dpAttribs = read(dp, "attributes");
                  if (Array.isArray(dpAttribs)) {
                    for (const a of dpAttribs) {
                      if (isObj(a)) {
                        const k = read(a, "key");
                        const v = read(a, "value");
                        if (typeof k === "string" && isObj(v)) {
                          const sv = read(v, "stringValue");
                          const iv = read(v, "intValue");
                          const dv = read(v, "doubleValue");
                          const bv = read(v, "boolValue");
                          dpAttrs[k] = sv ?? iv ?? dv ?? bv ?? v;
                        }
                      }
                    }
                  }
                  const timeUnixNano = read(dp, "timeUnixNano") as string | number | undefined;
                  const value = isObj(dp) ? (dp as Record<string, unknown>)[valueKey] : undefined;
                  dpAttrs["metric.name"] = name;
                  dpAttrs["metric.kind"] = kind;
                  if (unit) dpAttrs["metric.unit"] = unit;
                  if (description) dpAttrs["metric.description"] = description;
                  if (typeof value !== "undefined") dpAttrs["metric.value"] = value;

                  out.push(
                    fromRecord({
                      timeUnixNano: typeof timeUnixNano === "string" || typeof timeUnixNano === "number" ? timeUnixNano : undefined,
                      body: typeof name === "string" ? `metric: ${name}` : "metric",
                      attributes: dpAttrs,
                      resource: resourceAttrs,
                    })
                  );
                }
              };

              const sum = read(metric, "sum");
              const sumDps = isObj(sum) ? read(sum, "dataPoints") : undefined;
              if (Array.isArray(sumDps)) {
                emitDataPoints(sumDps as unknown[], "sum", "asInt");
                emitDataPoints(sumDps as unknown[], "sum", "asDouble");
              }
              const gauge = read(metric, "gauge");
              const gaugeDps = isObj(gauge) ? read(gauge, "dataPoints") : undefined;
              if (Array.isArray(gaugeDps)) {
                emitDataPoints(gaugeDps as unknown[], "gauge", "asInt");
                emitDataPoints(gaugeDps as unknown[], "gauge", "asDouble");
              }
              const hist = read(metric, "histogram");
              const histDps = isObj(hist) ? read(hist, "dataPoints") : undefined;
              if (Array.isArray(histDps)) {
                // Represent histogram by count & sum as separate messages for simplicity
                const dps = histDps as unknown[];
                emitDataPoints(dps, "histogram_count", "count");
                emitDataPoints(dps, "histogram_sum", "sum");
              }

              // Exponential Histogram: emit count/sum and approximate quantiles
              const expHist = read(metric, "exponentialHistogram");
              const expHistDps = isObj(expHist) ? read(expHist, "dataPoints") : undefined;
              if (Array.isArray(expHistDps)) {
                const dps = expHistDps as unknown[];
                // count & sum
                emitDataPoints(dps, "exponential_histogram_count", "count");
                emitDataPoints(dps, "exponential_histogram_sum", "sum");

                // Quantile estimation (rough) from positive buckets
                const quantiles = [0.5, 0.9, 0.95, 0.99];
                for (const dp of dps) {
                  if (!isObj(dp)) continue;
                  const scale = typeof read(dp, "scale") === "number" ? (read(dp, "scale") as number) : 0;
                  const zeroCount = typeof read(dp, "zeroCount") === "number" ? (read(dp, "zeroCount") as number) : 0;
                  const pos = isObj(read(dp, "positive")) ? (read(dp, "positive") as Record<string, unknown>) : undefined;
                  const posOffset = typeof pos?.["offset"] === "number" ? (pos["offset"] as number) : 0;
                  const posBuckets = Array.isArray(pos?.["bucketCounts"]) ? (pos!["bucketCounts"] as unknown[]) : [];
                  const posNums: number[] = (posBuckets as unknown[]).map((c) => (typeof c === "number" ? (c as number) : 0));
                  const count = typeof read(dp, "count") === "number" ? (read(dp, "count") as number) : (zeroCount + posNums.reduce((s: number, c: number) => s + c, 0));
                  if (count <= 0) continue;

                  // Build cumulative from positive buckets; ignore negatives for simplicity
                  const pairs: Array<{ v: number; c: number }> = [];
                  for (let i = 0; i < posBuckets.length; i++) {
                    const c = posBuckets[i];
                    const n = typeof c === "number" ? c : 0;
                    if (n <= 0) continue;
                    const idx = posOffset + i;
                    const base = Math.pow(2, Math.pow(2, -scale));
                    // Approximate bucket midpoint with base^idx
                    const approx = Math.pow(base, idx);
                    pairs.push({ v: approx, c: n });
                  }
                  let cum = zeroCount;
                  const thresholds = quantiles.map((q) => q * count);
                  const qVals: Record<string, number> = {};
                  let ti = 0;
                  for (const p of pairs) {
                    cum += p.c;
                    while (ti < thresholds.length && cum >= thresholds[ti]) {
                      qVals[String(quantiles[ti])] = p.v;
                      ti++;
                    }
                    if (ti >= thresholds.length) break;
                  }
                  const timeUnixNano = read(dp, "timeUnixNano") as string | number | undefined;
                  for (const q of quantiles) {
                    const qv = qVals[String(q)];
                    if (typeof qv !== "number") continue;
                    const dpAttrs: Record<string, unknown> = { ...resourceAttrs };
                    dpAttrs["metric.name"] = `${name}_p${Math.round(q * 100)}`;
                    dpAttrs["metric.kind"] = "exponential_histogram_quantile";
                    if (unit) dpAttrs["metric.unit"] = unit;
                    if (description) dpAttrs["metric.description"] = description;
                    dpAttrs["metric.value"] = qv;
                    out.push(
                      fromRecord({
                        timeUnixNano: typeof timeUnixNano === "string" || typeof timeUnixNano === "number" ? timeUnixNano : undefined,
                        body: typeof name === "string" ? `metric: ${name}` : "metric",
                        attributes: dpAttrs,
                        resource: resourceAttrs,
                      })
                    );
                  }
                }
              }

              // Summary: count, sum, and provided quantiles
              const summary = read(metric, "summary");
              const summaryDps = isObj(summary) ? read(summary, "dataPoints") : undefined;
              if (Array.isArray(summaryDps)) {
                const dps = summaryDps as unknown[];
                emitDataPoints(dps, "summary_count", "count");
                emitDataPoints(dps, "summary_sum", "sum");

                for (const dp of dps) {
                  if (!isObj(dp)) continue;
                  const qvs = read(dp, "quantileValues");
                  const timeUnixNano = read(dp, "timeUnixNano") as string | number | undefined;
                  if (Array.isArray(qvs)) {
                    for (const qv of qvs) {
                      if (!isObj(qv)) continue;
                      const q = read(qv, "quantile");
                      const val = read(qv, "value");
                      if (typeof q === "number" && (typeof val === "number" || typeof val === "string")) {
                        const pct = Math.round(q * 100);
                        const dpAttrs: Record<string, unknown> = { ...resourceAttrs };
                        dpAttrs["metric.name"] = `${name}_p${pct}`;
                        dpAttrs["metric.kind"] = "summary_quantile";
                        if (unit) dpAttrs["metric.unit"] = unit;
                        if (description) dpAttrs["metric.description"] = description;
                        dpAttrs["metric.value"] = val;
                        out.push(
                          fromRecord({
                            timeUnixNano: typeof timeUnixNano === "string" || typeof timeUnixNano === "number" ? timeUnixNano : undefined,
                            body: typeof name === "string" ? `metric: ${name}` : "metric",
                            attributes: dpAttrs,
                            resource: resourceAttrs,
                          })
                        );
                      }
                    }
                  }
                }
              }
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
            const v = read(r, "timeUnixNano");
            return typeof v === "string" || typeof v === "number" ? v : undefined;
          })(),
          body: read(r, "body"),
          resource: isObj(read(r, "resource")) ? (read(r, "resource") as Record<string, unknown>) : undefined,
          attributes: isObj(read(r, "attributes")) ? (read(r, "attributes") as Record<string, unknown>) : undefined,
          severityNumber: typeof read(r, "severityNumber") === "number" ? (read(r, "severityNumber") as number) : undefined,
          traceId: typeof read(r, "traceId") === "string" ? (read(r, "traceId") as string) : undefined,
          spanId: typeof read(r, "spanId") === "string" ? (read(r, "spanId") as string) : undefined,
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

// Extend manualExtract to also handle resourceMetrics
