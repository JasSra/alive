import { NextResponse } from "next/server";
import { ingestStore } from "@/lib/ingestStore";

export async function POST() {
  const suggestions = ingestStore.getSuggestions();
  return NextResponse.json(suggestions);
}
