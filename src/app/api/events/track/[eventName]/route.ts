import { NextRequest, NextResponse } from "next/server";
import { trackEvent } from "@/lib/store";
import type { AIEventPayload } from "@/lib/types";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ eventName: string }> },
) {
  const { eventName } = await context.params;
  if (!eventName?.trim()) {
    return NextResponse.json(
      { success: false, message: "Event name is required." },
      { status: 400 },
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
  return NextResponse.json(result);
}
