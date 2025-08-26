"use client";
import { memo, useState, useCallback, useRef, useEffect } from "react";

export interface TLItem {
  id: string;
  name: string;
  t: number; // epoch ms
  color?: string;
  correlationId?: string;
}

interface TimelineProps {
  items: TLItem[];
}

const Timeline = memo(function Timeline({ items }: TimelineProps) {
  const [hoveredItem, setHoveredItem] = useState<TLItem | null>(null);
  const [selectedItem, setSelectedItem] = useState<TLItem | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState(0);
  const svgRef = useRef<SVGSVGElement>(null);
  
  // Auto-scroll to latest events
  const [autoScroll, setAutoScroll] = useState(true);
  
  useEffect(() => {
    if (autoScroll && items.length > 0) {
      // Auto-pan to show the latest events
      const latestTime = Math.max(...items.map(i => i.t));
      const oldestTime = Math.min(...items.map(i => i.t));
      const span = latestTime - oldestTime;
      if (span > 0) {
        setPanOffset(-(span * 0.1)); // Show latest 90% of timeline
      }
    }
  }, [items, autoScroll]);

  // Normalize to fit width with zoom and pan
  const minT = items.length ? Math.min(...items.map((i) => i.t)) : 0;
  const maxT = items.length ? Math.max(...items.map((i) => i.t)) : 1;
  const span = Math.max(1, (maxT - minT) / zoomLevel);
  const viewStart = minT + panOffset;
  const viewEnd = viewStart + span;
  
  const formatUtcTime = (t: number) => {
    const d = new Date(t);
    let h = d.getUTCHours();
    const m = d.getUTCMinutes();
    const s = d.getUTCSeconds();
    const ms = d.getUTCMilliseconds();
    const am = h < 12;
    h = h % 12;
    if (h === 0) h = 12;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(h)}:${pad(m)}:${pad(s)}.${String(ms).padStart(3, "0")} ${am ? "AM" : "PM"}`;
  };
  
  const width = 1200;
  const height = 80;
  const pad = 16;
  const cxFor = (t: number) => {
    if (span <= 0) return pad;
    return pad + ((t - viewStart) / span) * (width - pad * 2);
  };
  const cy = height / 2;
  
  // Filter visible items
  const visibleItems = items.filter(i => i.t >= viewStart && i.t <= viewEnd);
  
  const handleZoom = useCallback((delta: number, clientX?: number) => {
    const newZoom = Math.max(0.1, Math.min(10, zoomLevel + delta));
    if (clientX && svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      const mouseX = (clientX - rect.left) / rect.width;
      const timeAtMouse = viewStart + mouseX * span;
      const newSpan = (maxT - minT) / newZoom;
      const newStart = timeAtMouse - mouseX * newSpan;
      setPanOffset(newStart - minT);
    }
    setZoomLevel(newZoom);
    setAutoScroll(false);
  }, [zoomLevel, viewStart, span, maxT, minT]);
  
  const resetView = useCallback(() => {
    setZoomLevel(1);
    setPanOffset(0);
    setAutoScroll(true);
  }, []);
  
  // Group items by correlation ID for better visualization
  const groupedItems = visibleItems.reduce((groups, item) => {
    const key = item.correlationId || 'standalone';
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
    return groups;
  }, {} as Record<string, TLItem[]>);

  return (
    <div className="w-full">
      {/* Timeline Controls */}
      <div className="flex items-center justify-between mb-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-neutral-400">Timeline Controls:</span>
          <button
            onClick={() => handleZoom(0.2)}
            className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 rounded border border-neutral-600 text-white"
            disabled={zoomLevel >= 10}
            title="Zoom in"
          >
            <span aria-hidden className="fa-solid fa-magnifying-glass-plus" />
          </button>
          <button
            onClick={() => handleZoom(-0.2)}
            className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 rounded border border-neutral-600 text-white"
            disabled={zoomLevel <= 0.1}
            title="Zoom out"
          >
            <span aria-hidden className="fa-solid fa-magnifying-glass-minus" />
          </button>
          <button
            onClick={resetView}
            className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 rounded border border-neutral-600 text-white"
          >
            <span aria-hidden className="fa-solid fa-arrows-to-dot" /> Reset
          </button>
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`px-2 py-1 rounded border ${autoScroll ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200' : 'bg-neutral-800 border-neutral-600 text-white'}`}
          >
            <span aria-hidden className="fa-solid fa-rotate" /> Auto-scroll
          </button>
        </div>
        <div className="flex items-center gap-2 text-neutral-400">
          <span>Zoom: {zoomLevel.toFixed(1)}x</span>
          <span>•</span>
          <span>Events: {visibleItems.length}/{items.length}</span>
        </div>
      </div>
      
      {/* Interactive Timeline */}
      <div className="relative bg-neutral-950 rounded-lg border border-neutral-700 p-2">
        <svg 
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`} 
          className="w-full h-20 cursor-crosshair select-none touch-none"
          onWheel={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            handleZoom(delta, e.clientX);
          }}
        >
          {/* Background grid */}
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgb(64 64 64)" strokeWidth="0.5" opacity="0.3"/>
            </pattern>
          </defs>
          <rect width={width} height={height} fill="url(#grid)" />
          
          {/* Timeline axis */}
          <line 
            x1={pad} x2={width - pad} y1={cy} y2={cy} 
            stroke="rgb(115 115 115)" strokeWidth="2" 
          />
          
          {/* Correlation group lanes */}
          {Object.entries(groupedItems).map(([corrId, groupItems], groupIndex) => {
            const yOffset = (groupIndex % 3) * 8 - 8; // Spread groups vertically
            const isSelected = selectedItem && groupItems.some(i => i.id === selectedItem.id);
            
            return (
              <g key={corrId} className={isSelected ? 'opacity-100' : hoveredItem ? 'opacity-50' : 'opacity-100'}>
                {/* Connection lines for correlated events */}
                {groupItems.length > 1 && corrId !== 'standalone' && (
                  <line
                    x1={cxFor(Math.min(...groupItems.map(i => i.t)))}
                    x2={cxFor(Math.max(...groupItems.map(i => i.t)))}
                    y1={cy + yOffset}
                    y2={cy + yOffset}
                    stroke="rgb(34 197 94)"
                    strokeWidth="2"
                    strokeDasharray="4,2"
                    opacity="0.6"
                  />
                )}
                
                {/* Event points */}
                {groupItems.map((item, index) => {
                  const cx = cxFor(item.t);
                  const color = item.color ?? (corrId === 'standalone' ? "#06b6d4" : "#10b981");
                  const isHovered = hoveredItem?.id === item.id;
                  const isItemSelected = selectedItem?.id === item.id;
                  
                  return (
                    <g key={item.id}>
                      {/* Event circle */}
                      <circle 
                        cx={cx} 
                        cy={cy + yOffset} 
                        r={isHovered || isItemSelected ? 8 : 6}
                        fill={color} 
                        stroke={isItemSelected ? "#fbbf24" : "#fff"}
                        strokeWidth={isItemSelected ? 3 : 1}
                        className="cursor-pointer transition-all duration-200 hover:drop-shadow-lg"
                        onMouseEnter={() => setHoveredItem(item)}
                        onMouseLeave={() => setHoveredItem(null)}
                        onClick={() => setSelectedItem(selectedItem?.id === item.id ? null : item)}
                      />
                      
                      {/* Event label */}
                      {(isHovered || isItemSelected) && (
                        <text
                          x={cx}
                          y={cy + yOffset - 12}
                          textAnchor="middle"
                          className="fill-white text-xs font-mono pointer-events-none drop-shadow-lg"
                        >
                          {item.name}
                        </text>
                      )}
                      
                      {/* Correlation indicator */}
                      {corrId !== 'standalone' && index === 0 && (
                        <text
                          x={cx}
                          y={cy + yOffset + 20}
                          textAnchor="middle"
                          className="fill-emerald-300 text-xs font-mono pointer-events-none"
                          opacity="0.8"
                        >
                          {corrId.slice(-8)}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
        
        {/* Time labels */}
        <div className="flex justify-between text-xs text-neutral-400 mt-2 px-2">
          <span>{viewStart ? formatUtcTime(viewStart) : ""}</span>
          <span>{viewEnd ? formatUtcTime(viewEnd) : ""}</span>
        </div>
        
        {/* Selected item details */}
        {selectedItem && (
          <div className="absolute top-2 right-2 bg-neutral-800 border border-neutral-600 rounded-lg p-2 text-xs max-w-xs">
            <div className="font-bold text-amber-300">{selectedItem.name}</div>
            <div className="text-neutral-300 mt-1">
              <div>Time: {formatUtcTime(selectedItem.t)}</div>
              {selectedItem.correlationId && (
                <div>Correlation: {selectedItem.correlationId}</div>
              )}
            </div>
            <button
              onClick={() => setSelectedItem(null)}
              className="absolute -top-1 -right-1 w-5 h-5 bg-neutral-700 hover:bg-neutral-600 rounded-full text-white text-xs flex items-center justify-center"
            >
              ×
            </button>
          </div>
        )}
        
        {/* Hover tooltip */}
        {hoveredItem && !selectedItem && (
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-neutral-800 border border-neutral-600 rounded px-2 py-1 text-xs whitespace-nowrap pointer-events-none">
            {hoveredItem.name} • {formatUtcTime(hoveredItem.t)}
          </div>
        )}
      </div>
    </div>
  );
});

export default Timeline;
