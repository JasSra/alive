"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useGlobalTimeline, type GlobalTimelineEvent } from '@/lib/globalTimeline';

interface TimelineProps {
  height?: number;
  showFilters?: boolean;
  showCorrelations?: boolean;
  selectedCorrelationId?: string;
  onEventSelect?: (event: GlobalTimelineEvent) => void;
  onCorrelationSelect?: (correlationId: string) => void;
}

export default function EnhancedTimeline({
  height = 300,
  showFilters = true,
  showCorrelations = true,
  selectedCorrelationId,
  onEventSelect,
  onCorrelationSelect
}: TimelineProps) {
  const {
    state,
    subscribe,
    getFilteredEvents,
    getAllCorrelations,
    getCorrelatedEvents,
    setFilters,
    setTimeRange,
    selectCorrelation,
    selectEvent,
    setLiveMode
  } = useGlobalTimeline();

  const [localState, setLocalState] = useState(state);
  const [hoveredEvent, setHoveredEvent] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState(0);

  useEffect(() => {
    const unsubscribe = subscribe(setLocalState);
    return unsubscribe;
  }, [subscribe]);

  const events = getFilteredEvents();
  const correlations = getAllCorrelations();

  // Calculate timeline dimensions and scale
  const timelineData = useMemo(() => {
    if (events.length === 0) {
      return { minTime: Date.now() - 3600000, maxTime: Date.now(), events: [] };
    }

    const minTime = Math.min(...events.map(e => e.timestamp));
    const maxTime = Math.max(...events.map(e => e.timestamp));
    const timeRange = maxTime - minTime || 3600000; // At least 1 hour

    return {
      minTime,
      maxTime,
      timeRange,
      events: events.map(e => ({
        ...e,
        x: ((e.timestamp - minTime) / timeRange) * 100, // Percentage position
      }))
    };
  }, [events]);

  // Handle zoom and pan
  const viewStart = timelineData.minTime + (panOffset * timelineData.timeRange);
  const viewEnd = viewStart + (timelineData.timeRange / zoomLevel);
  const visibleEvents = timelineData.events.filter(e => 
    e.timestamp >= viewStart && e.timestamp <= viewEnd
  );

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const formatDuration = (start: number, end: number) => {
    const diff = end - start;
    if (diff < 1000) return `${diff}ms`;
    if (diff < 60000) return `${(diff / 1000).toFixed(1)}s`;
    return `${(diff / 60000).toFixed(1)}m`;
  };

  const handleEventClick = (event: GlobalTimelineEvent) => {
    setSelectedEvent(event.id);
    selectEvent(event.id);
    onEventSelect?.(event);
    
    if (event.correlationId && onCorrelationSelect) {
      onCorrelationSelect(event.correlationId);
    }
  };

  const handleCorrelationClick = (correlationId: string) => {
    selectCorrelation(correlationId);
    onCorrelationSelect?.(correlationId);
    
    // Filter to show only this correlation
    setFilters({ correlationId });
  };

  const handleZoom = (delta: number, mouseX: number) => {
    const newZoom = Math.max(0.1, Math.min(10, zoomLevel * (1 + delta * 0.1)));
    
    if (newZoom !== zoomLevel) {
      // Adjust pan to zoom at mouse position
      const mouseTimeRatio = mouseX / 100; // Convert from percentage
      const timeAtMouse = viewStart + mouseTimeRatio * (viewEnd - viewStart);
      const newSpan = timelineData.timeRange / newZoom;
      const newStart = timeAtMouse - mouseTimeRatio * newSpan;
      setPanOffset((newStart - timelineData.minTime) / timelineData.timeRange);
      setZoomLevel(newZoom);
    }
  };

  const resetView = () => {
    setZoomLevel(1);
    setPanOffset(0);
    setFilters({});
    selectCorrelation(undefined);
  };

  // Group events by correlation
  const groupedEvents = useMemo(() => {
    const groups: Record<string, GlobalTimelineEvent[]> = {};
    
    visibleEvents.forEach(event => {
      const key = event.correlationId || 'standalone';
      if (!groups[key]) groups[key] = [];
      groups[key].push(event);
    });
    
    return groups;
  }, [visibleEvents]);

  const serviceColors: Record<string, string> = {
    'api': '#3b82f6',
    'web': '#10b981',
    'auth': '#f59e0b',
    'db': '#ef4444',
    'queue': '#8b5cf6',
  };

  const getServiceColor = (service?: string) => {
    if (!service) return '#6b7280';
    return serviceColors[service.toLowerCase()] || '#6b7280';
  };

  return (
    <div className="w-full bg-gray-800 border border-gray-700 rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-semibold text-white">Timeline View</h3>
          <div className="flex items-center space-x-2 text-sm text-gray-400">
            <span>{events.length} events</span>
            <span>•</span>
            <span>{correlations.length} correlations</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setLiveMode(!localState.isLive)}
            className={`px-3 py-1 text-sm rounded ${
              localState.isLive 
                ? 'bg-green-600 text-white' 
                : 'bg-gray-600 text-gray-300'
            }`}
          >
            {localState.isLive ? 'Live' : 'Paused'}
          </button>
          
          <button
            onClick={resetView}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Reset View
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="p-4 border-b border-gray-700">
          <div className="flex flex-wrap gap-2">
            {/* Service filter */}
            <select
              value={localState.filters.services?.[0] || ''}
              onChange={(e) => setFilters({ 
                services: e.target.value ? [e.target.value] : undefined 
              })}
              className="px-3 py-1 bg-gray-700 text-white rounded text-sm border border-gray-600"
            >
              <option value="">All Services</option>
              {Array.from(new Set(events.map(e => e.service).filter(Boolean))).map(service => (
                <option key={service} value={service}>{service}</option>
              ))}
            </select>

            {/* Type filter */}
            <select
              value={localState.filters.types?.[0] || ''}
              onChange={(e) => setFilters({ 
                types: e.target.value ? [e.target.value] : undefined 
              })}
              className="px-3 py-1 bg-gray-700 text-white rounded text-sm border border-gray-600"
            >
              <option value="">All Types</option>
              <option value="request">Requests</option>
              <option value="log">Logs</option>
              <option value="event">Events</option>
              <option value="metric">Metrics</option>
              <option value="raw">Raw</option>
            </select>

            {/* Clear filters */}
            {(localState.filters.services || localState.filters.types || localState.filters.correlationId) && (
              <button
                onClick={() => setFilters({})}
                className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
      )}

      {/* Timeline SVG */}
      <div className="relative" style={{ height }}>
        <svg
          width="100%"
          height="100%"
          className="bg-gray-900"
          onWheel={(e) => {
            e.preventDefault();
            const rect = e.currentTarget.getBoundingClientRect();
            const mouseX = ((e.clientX - rect.left) / rect.width) * 100;
            handleZoom(e.deltaY > 0 ? -1 : 1, mouseX);
          }}
        >
          {/* Grid lines */}
          <defs>
            <pattern id="timeline-grid" width="50" height="20" patternUnits="userSpaceOnUse">
              <path d="M 50 0 L 0 0 0 20" fill="none" stroke="rgb(75 85 99)" strokeWidth="0.5" opacity="0.3"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#timeline-grid)" />

          {/* Time axis */}
          <line 
            x1="5%" 
            x2="95%" 
            y1={height / 2} 
            y2={height / 2} 
            stroke="rgb(156 163 175)" 
            strokeWidth="2" 
          />

          {/* Correlation lanes and events */}
          {Object.entries(groupedEvents).map(([corrId, groupEvents], groupIndex) => {
            const yOffset = (groupIndex % 4) * 15 - 30; // Spread groups vertically
            const cy = height / 2 + yOffset;
            const isSelectedCorrelation = corrId === selectedCorrelationId || corrId === localState.selectedCorrelation;

            return (
              <g key={corrId} opacity={isSelectedCorrelation ? 1 : 0.7}>
                {/* Connection line for correlated events */}
                {groupEvents.length > 1 && corrId !== 'standalone' && (
                  <line
                    x1={`${Math.min(...groupEvents.map(e => e.x))}%`}
                    x2={`${Math.max(...groupEvents.map(e => e.x))}%`}
                    y1={cy}
                    y2={cy}
                    stroke="rgb(34 197 94)"
                    strokeWidth="2"
                    strokeDasharray="4,2"
                    opacity="0.6"
                  />
                )}

                {/* Event circles */}
                {groupEvents.map((event) => {
                  const isHovered = hoveredEvent === event.id;
                  const isSelected = selectedEvent === event.id;
                  const serviceColor = getServiceColor(event.service);

                  return (
                    <g key={event.id}>
                      <circle
                        cx={`${event.x}%`}
                        cy={cy}
                        r={isHovered || isSelected ? 8 : 6}
                        fill={event.color || serviceColor}
                        stroke={isSelected ? '#ffffff' : 'none'}
                        strokeWidth="2"
                        className="cursor-pointer transition-all"
                        onMouseEnter={() => setHoveredEvent(event.id)}
                        onMouseLeave={() => setHoveredEvent(null)}
                        onClick={() => handleEventClick(event)}
                      />
                      
                      {/* Event tooltip */}
                      {isHovered && (
                        <g>
                          <foreignObject
                            x={`calc(${event.x}% - 100px)`}
                            y={cy - 60}
                            width="200"
                            height="50"
                            className="pointer-events-none"
                          >
                            <div className="bg-black/90 text-white text-xs rounded p-2 shadow-xl border border-white/30">
                              <div className="font-medium">{formatTime(event.timestamp)}</div>
                              <div className="text-gray-300 truncate">{event.data.message}</div>
                              {event.service && (
                                <div className="text-gray-400">Service: {event.service}</div>
                              )}
                            </div>
                          </foreignObject>
                        </g>
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}

          {/* Time labels */}
          <text x="5%" y={height - 10} fill="rgb(156 163 175)" fontSize="12">
            {formatTime(viewStart)}
          </text>
          <text x="95%" y={height - 10} fill="rgb(156 163 175)" fontSize="12" textAnchor="end">
            {formatTime(viewEnd)}
          </text>
        </svg>

        {/* Zoom controls */}
        <div className="absolute top-4 right-4 flex flex-col space-y-1">
          <button
            onClick={() => handleZoom(1, 50)}
            className="w-8 h-8 bg-gray-700 text-white rounded flex items-center justify-center hover:bg-gray-600"
          >
            +
          </button>
          <button
            onClick={() => handleZoom(-1, 50)}
            className="w-8 h-8 bg-gray-700 text-white rounded flex items-center justify-center hover:bg-gray-600"
          >
            -
          </button>
        </div>
      </div>

      {/* Correlations panel */}
      {showCorrelations && correlations.length > 0 && (
        <div className="p-4 border-t border-gray-700">
          <h4 className="text-sm font-medium text-white mb-2">Active Correlations</h4>
          <div className="flex flex-wrap gap-2">
            {correlations.slice(0, 10).map((correlation) => (
              <button
                key={correlation.id}
                onClick={() => handleCorrelationClick(correlation.id)}
                className={`px-3 py-1 text-xs rounded border ${
                  correlation.id === selectedCorrelationId || correlation.id === localState.selectedCorrelation
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {correlation.id.length > 16 
                  ? `${correlation.id.substring(0, 16)}...`
                  : correlation.id
                } ({correlation.count})
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}