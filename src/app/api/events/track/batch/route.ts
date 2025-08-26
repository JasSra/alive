import { NextRequest, NextResponse } from "next/server";
import { trackEventsBatch } from "@/lib/store";
import type { BatchTrackEventRequest } from "@/lib/types";

export async function POST(req: NextRequest) {
  let body: BatchTrackEventRequest | null = null;
  try {
    body = (await req.json()) as BatchTrackEventRequest;
  } catch {
    // fallthrough
  }
  if (!body?.events?.length) {
    return NextResponse.json(
      { success: false, message: "At least one event is required." },
      { status: 400 },
    );
  }
  const userId = req.headers.get("x-user-id") ?? undefined;
  const results = trackEventsBatch(body.events, userId);
  return NextResponse.json(results);
}
