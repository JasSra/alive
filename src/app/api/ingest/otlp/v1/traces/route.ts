import { NextRequest, NextResponse } from "next/server";
import { unifiedIngest } from "@/lib/unifiedIngest";

export async function POST(req: NextRequest) {
  const ct = req.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    return NextResponse.json(
      {
        success: false,
        message: "Unsupported Content-Type. Use OTLP over HTTP JSON (application/json).",
        hint: "Set exporter protocol to HttpJson and post to /api/ingest/otlp/v1/traces",
        receivedContentType: ct,
      },
      { status: 415 }
    );
  }
  try {
    const body = await req.json();
    const result = await unifiedIngest(body);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch {
    return NextResponse.json({ success: false, message: "bad traces payload" }, { status: 400 });
  }
}
