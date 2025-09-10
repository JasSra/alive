import glossyPkg from "glossy";

export type BaseMessage = {
  id: string;
  ts: number;
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

function uuid() {
  const g = globalThis as unknown as { crypto?: { randomUUID?: () => string } };
  return g.crypto?.randomUUID?.() ?? "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Use glossy to parse RFC3164/RFC5424
export function parseSyslog(line: string, extra?: Partial<BaseMessage>): BaseMessage {
  const now = Date.now();
  const glossy = (glossyPkg as any).Parse;
  let host: string | undefined;
  let app: string | undefined;
  let msg: string = line;
  let ts = now;
  let severity: number | undefined;
  try {
    const parsed = glossy?.parse ? glossy.parse(line) : null;
    if (parsed && typeof parsed === "object") {
      host = (parsed.host as string) ?? host;
      app = (parsed.appName as string) ?? (parsed.tag as string) ?? app;
      msg = (parsed.message as string) ?? msg;
      const d = (parsed.date as Date | undefined) ?? undefined;
      if (d instanceof Date && !Number.isNaN(d.getTime())) ts = d.getTime();
      const pri = parsed.priority as number | undefined;
      if (typeof pri === "number") severity = pri % 8; // syslog PRI mapping
    }
  } catch {
    // fallback to raw
  }

  return {
    id: extra?.id ?? uuid(),
    ts,
    source: "syslog",
    message: msg,
    host: extra?.host ?? host,
    app: extra?.app ?? app,
    severity: extra?.severity ?? severity,
    serviceName: extra?.serviceName,
    traceId: extra?.traceId,
    spanId: extra?.spanId,
    correlationId: extra?.correlationId,
    attributes: { ...(extra?.attributes ?? {}), parser: "syslog" },
    raw: line,
  };
}
