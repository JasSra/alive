import { NextRequest, NextResponse } from "next/server";
import { trackEvent } from "@/lib/store";
import type { AIEventPayload } from "@/lib/types";

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

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ eventName: string }> },
) {
  try {
    const { eventName } = await context.params;
    if (!eventName?.trim()) {
      return NextResponse.json(
        { success: false, message: "Event name is required." },
        { 
          status: 400,
          headers: corsHeaders 
        },
      );
    }
    let payload: AIEventPayload | undefined;
    try {
      if (req.headers.get("content-type")?.includes("application/json")) {
        payload = (await req.json()) as AIEventPayload;
      }
    } catch {
      // ignore body parse errors
    }

    // enrich minimal http context
    payload = payload ?? {};
    payload.userAgent ??= req.headers.get("user-agent") ?? undefined;
    payload.referrer ??= req.headers.get("referer") ?? undefined;
    payload.metadata ??= {};
    payload.metadata.requestPath = req.nextUrl.pathname;
    payload.metadata.requestMethod = "POST";

    const userId = req.headers.get("x-user-id");
    const result = trackEvent(eventName, payload, userId ?? undefined);
    return NextResponse.json(result, {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Event tracking error:', error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { 
        status: 500,
        headers: corsHeaders 
      }
    );
  }
}
