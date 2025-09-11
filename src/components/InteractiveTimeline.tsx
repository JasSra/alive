"use client";
import { useState, useMemo, useCallback } from "react";
import styles from "./InteractiveTimeline.module.css";

interface Request {
  t: number;
  service?: string;
  method?: string;
  path?: string;
  status?: number;
  duration_ms?: number;
  correlationId?: string;
  [key: string]: unknown;
}

interface TimelineBucket {
  time: number;
  count: number;
  errors: number;
  avgLatency: number;
  methods: Record<string, number>;
  services: Record<string, number>;
  requests: Request[];
}

interface InteractiveTimelineProps {
  requests: Request[];
  onTimeRangeSelect?: (startTime: number, endTime: number) => void;
  onBucketClick?: (bucket: TimelineBucket) => void;
  className?: string;
}

export default function InteractiveTimeline({ 
  requests, 
  onTimeRangeSelect, 
  onBucketClick,
  className = "" 
}: InteractiveTimelineProps) {
  const [selectedRange, setSelectedRange] = useState<{ start: number; end: number } | null>(null);
  const [hoveredBucket, setHoveredBucket] = useState<TimelineBucket | null>(null);
  const [viewMode, setViewMode] = useState<'requests' | 'latency' | 'errors'>('requests');
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<number | null>(null);

  const timelineData = useMemo(() => {
    if (!requests.length) return null;

    const timestamps = requests.map(r => r.t).sort((a, b) => a - b);
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);
    const timeRange = maxTime - minTime;
    
    // Dynamic bucket count based on time range and data density
    let bucketCount = Math.min(100, Math.max(20, Math.ceil(timeRange / (2 * 60 * 1000)))); // 2-minute buckets
    if (timeRange < 60 * 60 * 1000) { // Less than 1 hour
      bucketCount = Math.min(60, Math.max(15, Math.ceil(timeRange / (60 * 1000)))); // 1-minute buckets
    }
    
    const bucketSize = timeRange / bucketCount;
    
    const buckets: TimelineBucket[] = Array.from({ length: bucketCount }, (_, i) => ({
      time: minTime + (i * bucketSize),
      count: 0,
      errors: 0,
      avgLatency: 0,
      methods: {},
      services: {},
      requests: []
    }));

    // Fill buckets with data
    requests.forEach(req => {
      const bucketIndex = Math.floor((req.t - minTime) / bucketSize);
      if (bucketIndex >= 0 && bucketIndex < buckets.length) {
        const bucket = buckets[bucketIndex];
        bucket.count++;
        bucket.requests.push(req);
        
        if (req.status && req.status >= 400) {
          bucket.errors++;
        }
        
        if (req.method) {
          bucket.methods[req.method] = (bucket.methods[req.method] || 0) + 1;
        }
        
        if (req.service) {
          bucket.services[req.service] = (bucket.services[req.service] || 0) + 1;
        }
      }
    });

    // Calculate average latency for each bucket
    buckets.forEach(bucket => {
      const bucketLatencies = bucket.requests
        .filter(r => r.duration_ms)
        .map(r => r.duration_ms!);
      
      if (bucketLatencies.length > 0) {
        bucket.avgLatency = bucketLatencies.reduce((sum, lat) => sum + lat, 0) / bucketLatencies.length;
      }
    });

    return { buckets, minTime, maxTime, bucketSize };
  }, [requests]);

  const getBarHeight = useCallback((bucket: TimelineBucket, maxValue: number) => {
    if (maxValue === 0) return 0;
    
    let value = 0;
    switch (viewMode) {
      case 'requests':
        value = bucket.count;
        break;
      case 'errors':
        value = bucket.errors;
        break;
      case 'latency':
        value = bucket.avgLatency;
        break;
    }
    
    return Math.max(2, (value / maxValue) * 100);
  }, [viewMode]);

  const getBarColor = useCallback((bucket: TimelineBucket) => {
    switch (viewMode) {
      case 'requests':
        const errorRate = bucket.count > 0 ? (bucket.errors / bucket.count) * 100 : 0;
        if (errorRate > 50) return 'bg-red-500';
        if (errorRate > 20) return 'bg-yellow-500';
        return 'bg-blue-500';
        
      case 'errors':
        if (bucket.errors === 0) return 'bg-gray-400';
        if (bucket.errors > 5) return 'bg-red-600';
        if (bucket.errors > 2) return 'bg-red-500';
        return 'bg-red-400';
        
      case 'latency':
        if (bucket.avgLatency === 0) return 'bg-gray-400';
        if (bucket.avgLatency > 1000) return 'bg-red-500';
        if (bucket.avgLatency > 500) return 'bg-yellow-500';
        if (bucket.avgLatency > 200) return 'bg-blue-500';
        return 'bg-green-500';
        
      default:
        return 'bg-blue-500';
    }
  }, [viewMode]);

  const maxValue = useMemo(() => {
    if (!timelineData) return 0;
    
    switch (viewMode) {
      case 'requests':
        return Math.max(...timelineData.buckets.map(b => b.count));
      case 'errors':
        return Math.max(...timelineData.buckets.map(b => b.errors));
      case 'latency':
        return Math.max(...timelineData.buckets.map(b => b.avgLatency));
      default:
        return 0;
    }
  }, [timelineData, viewMode]);

  const handleBucketClick = useCallback((bucket: TimelineBucket, index: number) => {
    if (!timelineData) return;
    
    if (isSelecting && selectionStart !== null) {
      // Complete selection
      const startIndex = Math.min(selectionStart, index);
      const endIndex = Math.max(selectionStart, index);
      const startTime = timelineData.buckets[startIndex].time;
      const endTime = timelineData.buckets[endIndex].time + timelineData.bucketSize;
      
      setSelectedRange({ start: startTime, end: endTime });
      onTimeRangeSelect?.(startTime, endTime);
      setIsSelecting(false);
      setSelectionStart(null);
    } else {
      // Start selection or single click
      if (onBucketClick) {
        onBucketClick(bucket);
      } else {
        setSelectionStart(index);
        setIsSelecting(true);
      }
    }
  }, [isSelecting, selectionStart, timelineData, onBucketClick, onTimeRangeSelect]);

  const clearSelection = useCallback(() => {
    setSelectedRange(null);
    setIsSelecting(false);
    setSelectionStart(null);
    onTimeRangeSelect?.(0, 0);
  }, [onTimeRangeSelect]);

  const formatTime = useCallback((timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  }, []);

  if (!timelineData) {
    return (
      <div className={`bg-white/5 backdrop-blur-sm rounded-lg border border-white/10 p-6 ${className}`}>
        <h3 className="text-lg font-semibold mb-4">Interactive Timeline</h3>
        <div className="text-gray-400 text-center py-8">No timeline data available</div>
      </div>
    );
  }

  return (
    <div className={`bg-white/5 backdrop-blur-sm rounded-lg border border-white/10 p-6 ${className}`}>
      {/* Header with controls */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold">Interactive Timeline</h3>
        
        <div className="flex items-center space-x-4">
          {/* View mode selector */}
          <div className="flex space-x-1 bg-slate-700/50 rounded-lg p-1">
            {[
              { mode: 'requests' as const, label: 'Requests', icon: '📊' },
              { mode: 'errors' as const, label: 'Errors', icon: '❌' },
              { mode: 'latency' as const, label: 'Latency', icon: '⏱️' }
            ].map((option) => (
              <button
                key={option.mode}
                onClick={() => setViewMode(option.mode)}
                className={`flex items-center space-x-1 px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                  viewMode === option.mode
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:text-white hover:bg-slate-600/50'
                }`}
              >
                <span className="text-xs">{option.icon}</span>
                <span>{option.label}</span>
              </button>
            ))}
          </div>
          
          {/* Clear selection */}
          {selectedRange && (
            <button
              onClick={clearSelection}
              className="px-3 py-1.5 text-sm bg-red-600/20 hover:bg-red-600/30 border border-red-600/30 rounded-lg text-red-300 transition-all"
            >
              Clear Selection
            </button>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="mb-4 text-xs text-gray-400">
        {isSelecting 
          ? 'Click another bar to complete time range selection' 
          : 'Click bars to inspect data • Click and drag to select time ranges'
        }
      </div>

      {/* Timeline bars */}
      <div className="relative w-full">
        <div className="w-full h-32 pb-4 relative">
          {/* Dynamic bar container with responsive width */}
          <div className="absolute inset-0 flex items-end pb-4">
            {timelineData.buckets.map((bucket, i) => {
              const height = getBarHeight(bucket, maxValue);
              const barColor = getBarColor(bucket);
              const isInSelection = selectedRange && 
                bucket.time >= selectedRange.start && 
                bucket.time <= selectedRange.end;
              const isSelectionStart = isSelecting && selectionStart === i;
              
              return (
                <div
                  key={i}
                  className={`group relative cursor-pointer transition-all h-full flex items-end ${styles.responsiveBarContainer}`}
                  onClick={() => handleBucketClick(bucket, i)}
                  onMouseEnter={() => setHoveredBucket(bucket)}
                  onMouseLeave={() => setHoveredBucket(null)}
                >
                  <div 
                    className={`${styles.responsiveBar} rounded-sm transition-all ${barColor} ${
                      isInSelection ? styles.selectedBar : ''
                    } ${
                      isSelectionStart ? styles.selectionStartBar : ''
                    } hover:brightness-110`}
                    style={{ '--bar-height': Math.max(2, height) } as React.CSSProperties}
                  />
                  
                  {/* Enhanced tooltip with higher z-index */}
                  {hoveredBucket === bucket && (
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-[10000]">
                      <div className="bg-black/95 backdrop-blur-sm text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-xl border border-white/30">
                        <div className="font-medium">{formatTime(bucket.time)}</div>
                        <div className="text-gray-300 mt-1">
                          <div>{bucket.count} requests</div>
                          {bucket.errors > 0 && <div className="text-red-300">{bucket.errors} errors</div>}
                          {bucket.avgLatency > 0 && <div className="text-blue-300">{bucket.avgLatency.toFixed(1)}ms avg</div>}
                        </div>
                        {Object.keys(bucket.methods).length > 0 && (
                          <div className="text-gray-400 mt-1 text-[10px]">
                            {Object.entries(bucket.methods).map(([method, count]) => (
                              <span key={method} className="mr-1">{method}:{count}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Time axis */}
        <div className="flex justify-between text-xs text-gray-400 mt-2">
          <span>{formatTime(timelineData.minTime)}</span>
          <span>{formatTime(timelineData.maxTime)}</span>
        </div>
      </div>

      {/* Selection info */}
      {selectedRange && (
        <div className="mt-4 p-3 bg-blue-600/20 rounded-lg border border-blue-600/30">
          <div className="text-sm font-medium text-blue-200">
            Selected: {formatTime(selectedRange.start)} - {formatTime(selectedRange.end)}
          </div>
          <div className="text-xs text-gray-300 mt-1">
            {timelineData.buckets
              .filter(b => b.time >= selectedRange.start && b.time <= selectedRange.end)
              .reduce((sum, b) => sum + b.count, 0)} requests in selected range
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 flex items-center justify-center space-x-6 text-xs text-gray-400">
        {viewMode === 'requests' && (
          <>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-blue-500 rounded-sm"></div>
              <span>Low errors (&lt;20%)</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-yellow-500 rounded-sm"></div>
              <span>Medium errors (20-50%)</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-red-500 rounded-sm"></div>
              <span>High errors (&gt;50%)</span>
            </div>
          </>
        )}
        {viewMode === 'latency' && (
          <>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-green-500 rounded-sm"></div>
              <span>Fast (&lt;200ms)</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-blue-500 rounded-sm"></div>
              <span>Medium (200-500ms)</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-yellow-500 rounded-sm"></div>
              <span>Slow (500-1000ms)</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-red-500 rounded-sm"></div>
              <span>Very slow (&gt;1000ms)</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
