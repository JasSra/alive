import { NextRequest, NextResponse } from "next/server";
import { getHistory } from "@/lib/store";

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams;
  const from = search.get("from");
  const to = search.get("to");
  const limit = Math.max(1, Math.min(1000, parseInt(search.get("limit") ?? "100", 10)));
  const userId = req.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json(
      { success: false, message: "User authentication required for event history." },
      { status: 401 },
    );
  }
  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;
  if ((from && Number.isNaN(+new Date(from))) || (to && Number.isNaN(+new Date(to)))) {
    return NextResponse.json(
      { success: false, message: "Invalid date format." },
      { status: 400 },
    );
  }
  const history = getHistory(userId, fromDate, toDate, limit);
  return NextResponse.json(history);
}
