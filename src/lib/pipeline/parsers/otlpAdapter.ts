import type { BaseMessage } from "../types"; // OTLP transformer adapter
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
  return {
    id: uuid(),
    ts,
    source: "otlp",
    message,
    serviceName,
    severity: typeof rec.severityNumber === "number" ? rec.severityNumber : undefined,
    traceId: rec.traceId,
    spanId: rec.spanId,
    attributes: { ...attrs, parser: "otlp" },
    raw: rec,
  };
}

function manualExtract(input: ExportLogsRequest): BaseMessage[] {
  const out: BaseMessage[] = [];
  if (!isObj(input)) return out;
  const resourceLogs = input["resourceLogs"];
  if (Array.isArray(resourceLogs)) {
    for (const rl of resourceLogs) {
      const resourceAttrs: Record<string, unknown> = {};
      if (isObj(rl?.resource) && Array.isArray(rl.resource["attributes"])) {
        for (const a of rl.resource["attributes"] as unknown[]) {
          if (isObj(a) && typeof a.key === "string" && isObj(a.value)) {
            const v = a.value as Record<string, unknown>;
            resourceAttrs[a.key] = v.stringValue ?? v.intValue ?? v.doubleValue ?? v.boolValue ?? v;
          }
        }
      }
      const scopeLogs = rl["scopeLogs"];
      if (Array.isArray(scopeLogs)) {
        for (const sl of scopeLogs) {
          const logRecords = sl?.logRecords;
          if (Array.isArray(logRecords)) {
            for (const lr of logRecords) {
              const attrs: Record<string, unknown> = { ...resourceAttrs };
              const lrAttrs = isObj(lr) ? (lr["attributes"] as unknown) : undefined;
              if (Array.isArray(lrAttrs)) {
                for (const a of lrAttrs) {
                  if (isObj(a) && typeof a.key === "string" && isObj(a.value)) {
                    const v = a.value as Record<string, unknown>;
                    attrs[a.key] = v.stringValue ?? v.intValue ?? v.doubleValue ?? v.boolValue ?? v;
                  }
                }
              }
              const timeUnixNano = isObj(lr) ? (lr["timeUnixNano"] as unknown) : undefined;
              const body = isObj(lr) ? (lr["body"] as unknown) : undefined;
              const severityNumber = isObj(lr) ? (lr["severityNumber"] as unknown) : undefined;
              const traceId = isObj(lr) ? (lr["traceId"] as unknown) : undefined;
              const spanId = isObj(lr) ? (lr["spanId"] as unknown) : undefined;
              out.push(
                fromRecord({
                  timeUnixNano: typeof timeUnixNano === "string" || typeof timeUnixNano === "number" ? timeUnixNano : undefined,
                  body,
                  severityNumber: typeof severityNumber === "number" ? severityNumber : undefined,
                  traceId: typeof traceId === "string" ? traceId : undefined,
                  spanId: typeof spanId === "string" ? spanId : undefined,
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

// Transform an OTLP ExportLogsServiceRequest JSON into BaseMessage[]
export async function transformOtlpLogsToBase(input: ExportLogsRequest): Promise<BaseMessage[]> {
  // Try dynamic import first for future-proofing; fallback to manual traversal
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
            const v = r["timeUnixNano"];
            return typeof v === "string" || typeof v === "number" ? v : undefined;
          })(),
          body: r["body"],
          resource: isObj(r["resource"]) ? (r["resource"] as Record<string, unknown>) : undefined,
          attributes: isObj(r["attributes"]) ? (r["attributes"] as Record<string, unknown>) : undefined,
          severityNumber: typeof r["severityNumber"] === "number" ? (r["severityNumber"] as number) : undefined,
          traceId: typeof r["traceId"] === "string" ? (r["traceId"] as string) : undefined,
          spanId: typeof r["spanId"] === "string" ? (r["spanId"] as string) : undefined,
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
