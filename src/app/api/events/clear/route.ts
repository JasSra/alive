import { NextResponse } from "next/server";
import { clearAllEvents } from "@/lib/store";
import { ingestStore } from "@/lib/ingestStore";

export async function POST() {
  // Clear both the events store and the ingest store
  const eventsRemoved = clearAllEvents();
  const ingestRemoved = ingestStore.clear();
  const totalRemoved = eventsRemoved + ingestRemoved;
  
  return NextResponse.json({ 
    success: true, 
    removed: totalRemoved,
    details: {
      events: eventsRemoved,
      ingest: ingestRemoved
    }
  });
}
