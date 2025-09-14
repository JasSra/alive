import { NextRequest, NextResponse } from "next/server";
import { ingestStore } from "@/lib/ingestStore";
import type { BatchTrackEventRequest } from "@/lib/types";

// Enhanced CORS headers for cross-origin event ingestion
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, X-Monitor-Request, X-User-Id, X-Session-Id, X-Correlation-Id, Accept, Origin, User-Agent, Referer",
  "Access-Control-Allow-Credentials": "false",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin",
};

// Handle preflight OPTIONS requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}

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
      { 
        status: 400,
        headers: corsHeaders 
      },
    );
  }
  const userId = req.headers.get("x-user-id") ?? undefined;
  const results = ingestStore.trackEventsBatch(body.events, userId);
  return NextResponse.json(results, {
    headers: corsHeaders
  });
}
