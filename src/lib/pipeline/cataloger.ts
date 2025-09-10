import { BaseMessage, CatalogedMessage } from "./types";

export function catalog(msg: BaseMessage): CatalogedMessage {
  // Simple routing: traces -> spans if traceId/spanId, otherwise logs
  const hasTrace = !!msg.traceId || !!msg.spanId;
  const collection: CatalogedMessage["collection"] = hasTrace ? "spans" : "logs";
  const day = new Date(msg.ts);
  const y = day.getUTCFullYear();
  const m = String(day.getUTCMonth() + 1).padStart(2, "0");
  const d = String(day.getUTCDate()).padStart(2, "0");
  const partitionKey = `${msg.serviceName ?? "unknown"}/${y}-${m}-${d}`;
  return { ...msg, collection, partitionKey };
}
