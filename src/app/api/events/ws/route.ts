export const runtime = "edge";

export async function GET(request: Request) {
  const upgradeHeader = request.headers.get("upgrade");
  if (upgradeHeader !== "websocket") {
    return new Response("Expected websocket upgrade", { status: 426 });
  }

  // For now, let's disable WebSocket in favor of SSE
  // Edge runtime WebSocket support varies by deployment platform
  return new Response("WebSocket not available, please use SSE transport", { status: 501 });
}
