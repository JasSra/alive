"use client";
import { useState, useEffect, useRef } from 'react';

export interface LiveCounts {
  requests: number;
  logs: number;
  events: number;
  metrics: number;
  raw: number;
}

export function useLiveCounts() {
  const [counts, setCounts] = useState<LiveCounts>({
    requests: 0,
    logs: 0, 
    events: 0,
    metrics: 0,
    raw: 0
  });
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    // Initial fetch to get current counts
    const fetchInitialCounts = async () => {
      try {
        const response = await fetch('/api/ingest');
        if (response.ok) {
          const data = await response.json();
          if (data.counts) {
            setCounts(data.counts);
          }
        }
      } catch (error) {
        console.error('Failed to fetch initial counts:', error);
      }
    };

    // Set up Server-Sent Events for real-time updates
    const setupSSE = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const eventSource = new EventSource('/api/events/stream');
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setIsConnected(true);
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Update counts when we receive new events
          // This is a simplified approach - in a real implementation,
          // you might want to increment counts based on event types
          fetchInitialCounts(); // Refetch counts after each event
        } catch (error) {
          console.error('Error parsing SSE data:', error);
        }
      };

      eventSource.onerror = () => {
        setIsConnected(false);
      };
    };

    fetchInitialCounts();
    setupSSE();

    // Also poll every 10 seconds as fallback
    const pollInterval = setInterval(fetchInitialCounts, 10000);

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      clearInterval(pollInterval);
    };
  }, []);

  return { counts, isConnected };
}