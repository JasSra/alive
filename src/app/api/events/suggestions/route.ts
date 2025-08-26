import { NextResponse } from "next/server";
import { getSuggestions } from "@/lib/store";

export async function POST() {
  const suggestions = getSuggestions();
  return NextResponse.json(suggestions);
}
