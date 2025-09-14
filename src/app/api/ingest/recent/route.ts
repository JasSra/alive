import { NextRequest, NextResponse } from "next/server";
import { ingestStore } from "@/lib/ingestStore";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const kind = (url.searchParams.get("kind") || "logs").toLowerCase();
  const limit = Math.max(1, Math.min(1000, Number(url.searchParams.get("limit") || 100)));

  const snap = ingestStore.snapshot();
  let items: unknown[];
  if (kind === "requests") items = snap.requests;
  else if (kind === "events") items = snap.events;
  else if (kind === "metrics") items = snap.metrics;
  else items = snap.logs;

  const start = Math.max(0, items.length - limit);
  const result = items.slice(start).reverse(); // newest first

  return NextResponse.json({ ok: true, kind, count: result.length, items: result });
}
