import { NextResponse } from "next/server";
import { clearAllEvents } from "@/lib/store";

export async function POST() {
  const removed = clearAllEvents();
  return NextResponse.json({ success: true, removed });
}
