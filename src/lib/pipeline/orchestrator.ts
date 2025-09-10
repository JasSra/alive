import { PipelineContext, IngestResult, CatalogedMessage } from "./types";
import { parseSyslog } from "./parsers/syslog";
import { parseOtlp } from "./parsers/otlp";
import { attachContext, ensureCorrelation, normalizeTimestamp, errorFlagEnricher, severityEnricher } from "./enhancers";
import { catalog } from "./cataloger";
import { memorySink } from "./storageMemory";

export async function ingestSyslog(lines: string | string[], ctx: PipelineContext): Promise<IngestResult> {
  try {
    const arr = Array.isArray(lines) ? lines : [lines];
    const out: CatalogedMessage[] = arr
      .map((l) => parseSyslog(l))
      .map((m) => attachContext(m, ctx))
      .map(normalizeTimestamp)
      .map(ensureCorrelation)
      .map(severityEnricher)
      .map(errorFlagEnricher)
      .map(catalog);
    const res = await memorySink.write(out);
    return { success: true, written: res.written };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, message: msg };
  }
}

export async function ingestOtlp(payload: unknown | unknown[], ctx: PipelineContext): Promise<IngestResult> {
  try {
  const { transformOtlpLogsToBase } = await import("./parsers/otlpAdapter");
    const messages = Array.isArray(payload)
      ? (await Promise.all(payload.map((p) => transformOtlpLogsToBase(p)))).flat()
      : await transformOtlpLogsToBase(payload);
    const out: CatalogedMessage[] = (messages.length
      ? messages
      : Array.isArray(payload)
        ? payload.map((p) => parseOtlp(p))
        : [parseOtlp(payload)])
      .map((m) => attachContext(m, ctx))
      .map(normalizeTimestamp)
      .map(ensureCorrelation)
      .map(severityEnricher)
      .map(errorFlagEnricher)
      .map(catalog);
    const res = await memorySink.write(out);
    return { success: true, written: res.written };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, message: msg };
  }
}

export function storageStats() {
  return memorySink.stats();
}

export function storageSample(limit = 25) {
  return memorySink.sample(limit);
}
