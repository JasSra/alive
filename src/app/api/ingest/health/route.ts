import { NextResponse } from "next/server";
import { ingestStore } from "@/lib/ingestStore";

export async function GET() {
  const counts = ingestStore.counts();
  return NextResponse.json({ ok: true, counts, t: new Date().toISOString() });
}
