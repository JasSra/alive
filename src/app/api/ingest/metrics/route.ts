import { NextResponse } from "next/server";
import { ingestStore } from "@/lib/ingestStore";

export async function GET() {
  const snap = ingestStore.snapshot();
  const counts = ingestStore.counts();
  const statusHisto: Record<string, number> = {};
  for (const r of snap.requests) {
    if (typeof r.status === "number") {
      const k = String(r.status);
      statusHisto[k] = (statusHisto[k] || 0) + 1;
    }
  }
  return NextResponse.json({ ok: true, counts, statusHisto });
}
