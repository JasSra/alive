import { registerSSEClient } from "@/lib/store";

// Switch to Node.js runtime to test if Edge runtime is causing issues
export const runtime = "nodejs";

// Enhanced CORS headers for SSE cross-origin requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, X-Monitor-Request, Accept, Origin, User-Agent, Cache-Control",
  "Access-Control-Allow-Credentials": "false",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin",
};

// Handle preflight OPTIONS requests
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export async function GET() {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      let isClosed = false;
      
      const send = (chunk: string) => {
        if (!isClosed) {
          try {
            controller.enqueue(encoder.encode(chunk));
          } catch {
            isClosed = true;
            console.log('[SSE] Controller already closed, marking as closed');
          }
        }
      };
      
      const unregister = registerSSEClient(send);

      const keepAlive = setInterval(() => {
        if (!isClosed) {
          try {
            send(`event: ping\ndata: {"t":${Date.now()}}\n\n`);
          } catch {
            isClosed = true;
          }
        }
      }, 25000);

      // Send a comment line immediately to establish stream
      send(": connected\n\n");

      return () => {
        isClosed = true;
        clearInterval(keepAlive);
        unregister();
        try {
          controller.close();
        } catch {
          // ignore
        }
      };
    },
    cancel() {
      // handled by return in start
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      ...corsHeaders,
    },
  });
}
