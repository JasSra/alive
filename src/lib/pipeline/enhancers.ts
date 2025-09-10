import { BaseMessage, PipelineContext } from "./types";

export function normalizeTimestamp(msg: BaseMessage): BaseMessage {
  // Clamp unreasonable timestamps
  const now = Date.now();
  if (msg.ts > now + 5 * 60_000 || msg.ts < 0) {
    return { ...msg, ts: now };
  }
  return msg;
}

export function attachContext(msg: BaseMessage, ctx: PipelineContext): BaseMessage {
  const attributes = { ...(msg.attributes ?? {}), receivedAt: ctx.receivedAt } as Record<string, unknown>;
  if (ctx.ip) attributes["ingest.ip"] = ctx.ip;
  if (ctx.userAgent) attributes["ingest.ua"] = ctx.userAgent;
  return { ...msg, attributes };
}

export function ensureCorrelation(msg: BaseMessage): BaseMessage {
  if (msg.correlationId) return msg;
  const g = globalThis as unknown as { crypto?: { randomUUID?: () => string } };
  const uuid = g.crypto?.randomUUID?.() ?? "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
  return { ...msg, correlationId: uuid };
}

export function severityEnricher(msg: BaseMessage): BaseMessage {
  const sev = msg.severity;
  let sevLabel: string | undefined;
  const num = typeof sev === "number" ? sev : undefined;
  if (typeof sev === "string") sevLabel = sev;
  else if (typeof num === "number") {
    // Map syslog 0..7 reverse (0 emerg -> high severity)
    const map: Record<number, string> = {
      0: "emerg",
      1: "alert",
      2: "crit",
      3: "error",
      4: "warn",
      5: "notice",
      6: "info",
      7: "debug",
    };
    sevLabel = map[num] ?? "info";
  }
  const attributes = { ...(msg.attributes ?? {}), severityLabel: sevLabel };
  return { ...msg, attributes };
}

export function errorFlagEnricher(msg: BaseMessage): BaseMessage {
  const text = (msg.message || "").toLowerCase();
  const sev = (msg.attributes?.severityLabel as string | undefined) ?? (typeof msg.severity === "string" ? msg.severity : undefined);
  const isError = ["error", "crit", "alert", "emerg"].includes(sev ?? "") || /\berror\b|\bexception\b|\bfail(ed|ure)?\b/.test(text);
  return { ...msg, attributes: { ...(msg.attributes ?? {}), error: isError } };
}
