export type SourceKind = "syslog" | "otlp";

export type Severity =
  | "debug"
  | "info"
  | "notice"
  | "warn"
  | "error"
  | "crit"
  | "alert"
  | "emerg";

export interface BaseMessage {
  id: string;
  ts: number; // epoch ms
  source: SourceKind;
  message: string;
  serviceName?: string;
  host?: string;
  app?: string;
  severity?: Severity | number;
  traceId?: string;
  spanId?: string;
  correlationId?: string;
  attributes?: Record<string, unknown>;
  raw?: unknown;
}

export interface PipelineContext {
  receivedAt: number; // server receive time
  ip?: string | null;
  userAgent?: string | null;
}

export type Stage<TIn = unknown, TOut = unknown> = (input: TIn, ctx: PipelineContext) => TOut | Promise<TOut>;

export interface CatalogedMessage extends BaseMessage {
  collection: "logs" | "spans" | "events";
  partitionKey?: string; // e.g., serviceName or date
}

export interface StorageSink {
  write(batch: CatalogedMessage[]): Promise<{ written: number }>;
  stats(): { total: number; byCollection: Record<string, number> };
  sample(limit?: number): CatalogedMessage[];
}

export type IngestResult = { success: true; written: number } | { success: false; message: string };
