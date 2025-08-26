import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ success: true, result: { status: "healthy", timestamp: new Date().toISOString(), service: "EventTracker", version: "0.1.0" } });
}
