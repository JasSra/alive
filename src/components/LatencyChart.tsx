"use client";
import { useMemo } from "react";

interface LatencyChartProps {
  data: Array<{
    time: string;
    latency: number;
    status?: number;
  }>;
  className?: string;
}

export default function LatencyChart({ data, className = "" }: LatencyChartProps) {
  const chartData = useMemo(() => {
    if (!data.length) return { points: [], maxLatency: 100, minLatency: 0, width: 400, height: 120, padding: 20 };

    const sortedData = [...data].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    const latencies = sortedData.map(d => d.latency).filter(l => l > 0);
    
    const maxLatency = Math.max(...latencies, 100);
    const minLatency = Math.min(...latencies, 0);
    const range = maxLatency - minLatency || 1;

    const width = 400;
    const height = 120;
    const padding = 20;

    const points = sortedData.map((point, index) => {
      const x = padding + (index / (sortedData.length - 1 || 1)) * (width - 2 * padding);
      const y = height - padding - ((point.latency - minLatency) / range) * (height - 2 * padding);
      const isError = point.status && point.status >= 400;
      
      return {
        x,
        y,
        latency: point.latency,
        time: point.time,
        isError,
        status: point.status
      };
    });

    return { points, maxLatency, minLatency, width, height, padding };
  }, [data]);

  if (!data.length) {
    return (
      <div className={`flex items-center justify-center h-32 bg-gray-800/50 rounded-lg ${className}`}>
        <p className="text-gray-400 text-sm">No latency data available</p>
      </div>
    );
  }

  return (
    <div className={`bg-gray-800/50 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-gray-300">Latency Over Time</h4>
        <div className="flex items-center space-x-4 text-xs text-gray-400">
          <span>Max: {Math.round(chartData.maxLatency)}ms</span>
          <span>Min: {Math.round(chartData.minLatency)}ms</span>
        </div>
      </div>
      
      <div className="relative">
        <svg 
          width={chartData.width} 
          height={chartData.height} 
          className="w-full" 
          viewBox={`0 0 ${chartData.width} ${chartData.height}`}
        >
          {/* Grid lines */}
          <defs>
            <pattern id="grid" width="40" height="20" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 20" fill="none" stroke="rgba(156, 163, 175, 0.1)" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
          
          {/* Chart area */}
          <rect 
            x={chartData.padding} 
            y={chartData.padding} 
            width={chartData.width - 2 * chartData.padding} 
            height={chartData.height - 2 * chartData.padding} 
            fill="none" 
            stroke="rgba(156, 163, 175, 0.2)" 
            strokeWidth="1"
          />
          
          {/* Latency line */}
          {chartData.points.length > 1 && (
            <polyline
              fill="none"
              stroke="#3b82f6"
              strokeWidth="2"
              points={chartData.points.map(p => `${p.x},${p.y}`).join(' ')}
            />
          )}
          
          {/* Data points */}
          {chartData.points.map((point, index) => (
            <circle
              key={index}
              cx={point.x}
              cy={point.y}
              r="3"
              fill={point.isError ? "#ef4444" : "#3b82f6"}
              stroke={point.isError ? "#dc2626" : "#1d4ed8"}
              strokeWidth="1"
              className="cursor-pointer hover:r-4 transition-all"
            >
              <title>
                {`${new Date(point.time).toLocaleTimeString()}: ${point.latency}ms${point.status ? ` (${point.status})` : ''}`}
              </title>
            </circle>
          ))}
          
          {/* Y-axis labels */}
          <text x="5" y={chartData.padding + 5} className="fill-gray-400" fontSize="10">
            {Math.round(chartData.maxLatency)}ms
          </text>
          <text x="5" y={chartData.height - chartData.padding + 5} className="fill-gray-400" fontSize="10">
            {Math.round(chartData.minLatency)}ms
          </text>
        </svg>
        
        {/* Legend */}
        <div className="flex items-center space-x-4 mt-2 text-xs">
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
            <span className="text-gray-400">Success</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 rounded-full bg-red-500"></div>
            <span className="text-gray-400">Error</span>
          </div>
        </div>
      </div>
    </div>
  );
}
