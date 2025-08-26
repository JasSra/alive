import { NextRequest, NextResponse } from "next/server";
import { cleanupOldData } from "@/lib/store";

export async function POST(req: NextRequest) {
  const search = req.nextUrl.searchParams;
  const retentionDays = Math.max(30, Math.min(365, parseInt(search.get("retentionDays") ?? "90", 10)));
  const roles = req.headers.get("x-user-roles") ?? "";
  const isAdmin = roles.split(",").some((r) => r.trim().toLowerCase().includes("admin"));
  if (!isAdmin) {
    return NextResponse.json({ success: false, message: "Administrative privileges required." }, { status: 403 });
  }
  const removed = cleanupOldData(retentionDays);
  return NextResponse.json({ success: true, result: `Removed ${removed} events` });
}
