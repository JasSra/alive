"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { openEventStream } from "@/lib/api";

export type Transport = "sse" | "ws";

export interface LiveFeedEvent<T = unknown> { id: string; t: number; data: T }

export function useLiveFeed<T = unknown>(enabled: boolean, transport: Transport = "sse", max = 500) {
  const [events, setEvents] = useState<LiveFeedEvent<T>[]>([]);
  const [status, setStatus] = useState<"idle" | "connecting" | "open" | "error">("idle");
  const disposeRef = useRef<(() => void) | null>(null);

  const onMessage = useCallback((data: unknown) => {
  const t = Date.now();
  const id = typeof crypto !== "undefined" && typeof (crypto as Crypto).randomUUID === "function" ? (crypto as Crypto).randomUUID() : String(t);
    setEvents((prev) => {
      const next = [{ id, t, data: data as T }, ...prev];
      if (next.length > max) next.length = max;
      return next;
    });
  }, [max]);

  useEffect(() => {
    disposeRef.current?.();
    setStatus("idle");
    if (!enabled) return;
    
    if (transport === "sse") {
      disposeRef.current = openEventStream(onMessage, setStatus);
      return () => disposeRef.current?.();
    }
    
    // WebSocket implementation
    try {
      setStatus("connecting");
      const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
      const wsUrl = origin.replace(/^http/, "ws") + "/api/events/ws";
      console.log("Attempting WebSocket connection:", wsUrl);
      
      const ws = new WebSocket(wsUrl);
      let heartbeat: number | null = null;
      let connectionTimeout: number | null = null;
      
      // Set connection timeout
      connectionTimeout = window.setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          console.log("WebSocket connection timeout, falling back to SSE");
          ws.close();
          // Fallback to SSE
          setStatus("connecting");
          disposeRef.current = openEventStream(onMessage, setStatus);
        }
      }, 5000); // 5 second timeout
      
      ws.onopen = () => {
        console.log("WebSocket connected successfully");
        if (connectionTimeout) {
          window.clearTimeout(connectionTimeout);
          connectionTimeout = null;
        }
        setStatus("open");
        // Start heartbeat
        heartbeat = window.setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            try { 
              ws.send("ping"); 
            } catch (e) {
              console.error("Heartbeat ping failed:", e);
            }
          }
        }, 15000);
      };
      
      ws.onmessage = (e) => {
        try { 
          const data = JSON.parse(e.data);
          console.log("WebSocket message:", data);
          onMessage(data); 
        } catch (err) {
          console.error("Failed to parse WebSocket message:", err);
        }
      };
      
      ws.onerror = (error) => {
        console.log("WebSocket error occurred, will attempt fallback to SSE:", error);
        // Don't set error status immediately, let onclose handle fallback
      };
      
      ws.onclose = (event) => {
        console.log("WebSocket closed:", event.code, event.reason);
        if (connectionTimeout) {
          window.clearTimeout(connectionTimeout);
          connectionTimeout = null;
        }
        if (heartbeat) {
          window.clearInterval(heartbeat);
          heartbeat = null;
        }
        
        // If we haven't successfully connected yet or if we lose connection, fallback to SSE
        if (event.code !== 1000) { // 1000 = normal closure
          console.log("WebSocket failed, falling back to SSE");
          setStatus("connecting");
          disposeRef.current = openEventStream(onMessage, setStatus);
        } else {
          setStatus("idle");
        }
      };
      
      disposeRef.current = () => {
        if (connectionTimeout) {
          window.clearTimeout(connectionTimeout);
          connectionTimeout = null;
        }
        if (heartbeat) {
          window.clearInterval(heartbeat);
          heartbeat = null;
        }
        ws.close(1000, "Component unmounted");
      };
      
      return () => disposeRef.current?.();
      
    } catch (error) {
      console.log("WebSocket setup failed, falling back to SSE:", error);
      // Fallback to SSE
      setStatus("connecting");
      disposeRef.current = openEventStream(onMessage, setStatus);
      return () => disposeRef.current?.();
    }
  }, [enabled, transport, onMessage]);

  const clear = useCallback(() => setEvents([]), []);
  return { events, clear, status };
}
