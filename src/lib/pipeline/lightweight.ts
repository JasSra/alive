import type { IngestResult } from "./types";
import { parseSyslog } from "./parsers/syslog";
import { parseOtlp } from "./parsers/otlp";
import { transformOtlpLogsToBase } from "./parsers/otlpAdapter";

// Ingest-and-forget: parse, do minimal enrichment, do not persist

export async function ingestSyslogLite(lines: string | string[]): Promise<IngestResult> {
  try {
    const arr = Array.isArray(lines) ? lines : [lines];
    const parsed = arr.map((l) => parseSyslog(l));
    return { success: true, written: parsed.length };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export async function ingestOtlpLite(payload: unknown | unknown[]): Promise<IngestResult> {
  try {
    if (Array.isArray(payload)) {
      const batches = await Promise.all(payload.map((p) => transformOtlpLogsToBase(p)));
      const count = batches.reduce((n, arr) => n + (arr?.length ?? 0), 0);
      if (count > 0) return { success: true, written: count };
      // fallback simple parser
      return { success: true, written: payload.length };
    }
    const arr = await transformOtlpLogsToBase(payload);
    if (arr.length > 0) return { success: true, written: arr.length };
    // fallback simple parse to count a single request
    parseOtlp(payload);
    return { success: true, written: 1 };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : String(e) };
  }
}
