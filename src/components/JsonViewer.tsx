"use client";
import { useState } from "react";

interface JsonViewerProps {
  data: unknown;
  className?: string;
}

interface ExpandableRowProps {
  keyName: string;
  value: unknown;
  level: number;
}

function ExpandableRow({ keyName, value, level }: ExpandableRowProps) {
  const [isExpanded, setIsExpanded] = useState(level < 2); // Auto-expand first 2 levels
  const indent = level * 20;
  
  const getValueType = (val: unknown): string => {
    if (val === null) return "null";
    if (val === undefined) return "undefined";
    if (Array.isArray(val)) return "array";
    if (typeof val === "object") return "object";
    if (typeof val === "string") return "string";
    if (typeof val === "number") return "number";
    if (typeof val === "boolean") return "boolean";
    return "unknown";
  };

  const valueType = getValueType(value);
  const isExpandable = valueType === "object" || valueType === "array";
  const hasChildren = isExpandable && value && Object.keys(value as Record<string, unknown>).length > 0;

  const formatValue = (val: unknown): string => {
    switch (valueType) {
      case "string":
        return `"${val}"`;
      case "number":
      case "boolean":
        return String(val);
      case "null":
        return "null";
      case "undefined":
        return "undefined";
      case "array":
        return `Array(${(val as unknown[]).length})`;
      case "object":
        return `Object(${Object.keys(val as Record<string, unknown>).length})`;
      default:
        return String(val);
    }
  };

  const getTypeColor = (type: string): string => {
    switch (type) {
      case "string": return "text-green-400";
      case "number": return "text-blue-400";
      case "boolean": return "text-purple-400";
      case "null": return "text-gray-400";
      case "array": return "text-yellow-400";
      case "object": return "text-cyan-400";
      default: return "text-gray-300";
    }
  };

  return (
    <>
      <tr className="hover:bg-white/5 transition-colors group">
        <td className={`py-1 px-2 border-r border-white/10 pl-${Math.min(Math.floor(indent / 4) + 2, 12)}`}>
          <div className="flex items-center space-x-2">
            {isExpandable && hasChildren ? (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-4 h-4 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                title={isExpanded ? "Collapse" : "Expand"}
              >
                <svg
                  className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ) : (
              <div className="w-4 h-4"></div>
            )}
            <span className="text-white font-mono text-sm">{keyName}</span>
          </div>
        </td>
        <td className="py-1 px-2 border-r border-white/10">
          <span className={`text-xs font-mono ${getTypeColor(valueType)}`}>
            {valueType}
          </span>
        </td>
        <td className="py-1 px-2">
          <span className={`font-mono text-sm ${getTypeColor(valueType)}`}>
            {formatValue(value)}
          </span>
        </td>
      </tr>

      {isExpanded && hasChildren && (
        <>
          {Object.entries(value as Record<string, unknown>).map(([key, val]) => (
            <ExpandableRow
              key={`${keyName}.${key}`}
              keyName={key}
              value={val}
              level={level + 1}
            />
          ))}
        </>
      )}
    </>
  );
}

export default function JsonViewer({ data, className = "" }: JsonViewerProps) {
  if (!data) {
    return (
      <div className={`text-gray-400 text-center py-4 ${className}`}>
        No data to display
      </div>
    );
  }

  return (
    <div className={`bg-gray-900/50 rounded-lg border border-white/10 overflow-hidden ${className}`}>
      <div className="overflow-auto max-h-96">
        <table className="w-full text-sm">
          <thead className="bg-white/5 sticky top-0">
            <tr>
              <th className="text-left py-2 px-2 text-gray-300 font-medium border-r border-white/10">Key</th>
              <th className="text-left py-2 px-2 text-gray-300 font-medium border-r border-white/10 w-20">Type</th>
              <th className="text-left py-2 px-2 text-gray-300 font-medium">Value</th>
            </tr>
          </thead>
          <tbody>
            {typeof data === "object" && data !== null ? (
              Object.entries(data as Record<string, unknown>).map(([key, value]) => (
                <ExpandableRow
                  key={key}
                  keyName={key}
                  value={value}
                  level={0}
                />
              ))
            ) : (
              <ExpandableRow
                keyName="value"
                value={data}
                level={0}
              />
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
