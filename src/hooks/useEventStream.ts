"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { openEventStream } from "@/lib/api";

export interface LiveEvent<T = unknown> {
  id: string;
  t: number;
  data: T;
}

export function useEventStream<T = unknown>(max = 100) {
  const [events, setEvents] = useState<LiveEvent<T>[]>([]);
  const disposeRef = useRef<(() => void) | null>(null);

  const onMessage = useCallback((data: unknown) => {
    const item: LiveEvent<T> = { id: crypto.randomUUID(), t: Date.now(), data: data as T };
    setEvents((prev) => {
      const next = [item, ...prev];
      if (next.length > max) next.length = max;
      return next;
    });
  }, [max]);

  useEffect(() => {
    disposeRef.current?.();
    disposeRef.current = openEventStream(onMessage);
    return () => disposeRef.current?.();
  }, [onMessage]);

  const clear = useCallback(() => setEvents([]), []);

  return { events, clear };
}
