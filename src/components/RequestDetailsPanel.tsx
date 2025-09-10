"use client";
import { useState, useMemo } from "react";
import JsonViewer from "./JsonViewer";

interface RequestData {
  t?: string | number;
  method?: string;
  path?: string;
  status?: number;
  duration_ms?: number;
  service?: string;
  correlationId?: string;
  headers?: Record<string, unknown>;
  body?: unknown;
  response?: {
    headers?: Record<string, unknown>;
    body?: unknown;
    [key: string]: unknown;
  };
  attrs?: {
    clientIp?: string;
    ip?: string;
    headers?: Record<string, unknown>;
    body?: unknown;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface RequestDetailsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  requestData: RequestData | null;
  className?: string;
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

interface HeaderRow {
  key: string;
  type: string;
  value: string;
  truncated?: boolean;
}

function TabButton({ active, onClick, children }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
        active
          ? "bg-blue-600 text-white"
          : "bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

// Copy to clipboard function
function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text).then(() => {
    // You could add a toast notification here
    console.log(`Copied ${label}: ${text}`);
  }).catch(err => {
    console.error('Failed to copy:', err);
  });
}

// Enhanced Headers Table Component
function HeadersTable({ headers, title }: { headers: Record<string, unknown>, title: string }) {
  const [sortField, setSortField] = useState<'key' | 'type' | 'value'>('key');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const headerRows: HeaderRow[] = useMemo(() => {
    return Object.entries(headers).map(([key, value]) => {
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      const type = typeof value;
      const truncated = stringValue.length > 50;
      
      return {
        key,
        type,
        value: stringValue,
        truncated
      };
    });
  }, [headers]);

  const sortedHeaders = useMemo(() => {
    return [...headerRows].sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];
      
      if (sortDirection === 'desc') {
        [aValue, bValue] = [bValue, aValue];
      }
      
      return aValue.localeCompare(bValue);
    });
  }, [headerRows, sortField, sortDirection]);

  const handleSort = (field: 'key' | 'type' | 'value') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const toggleExpanded = (key: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedRows(newExpanded);
  };

  const SortIcon = ({ field }: { field: 'key' | 'type' | 'value' }) => {
    if (sortField !== field) {
      return <span className="text-gray-600">↕️</span>;
    }
    return <span className="text-blue-400">{sortDirection === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className="bg-white/5 rounded-lg overflow-hidden">
      <div className="px-4 py-2 bg-white/5 border-b border-white/10">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-white/5">
            <tr>
              <th 
                className="text-left py-2 px-3 font-medium text-gray-300 cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => handleSort('key')}
              >
                <div className="flex items-center space-x-1">
                  <span>Key</span>
                  <SortIcon field="key" />
                </div>
              </th>
              <th 
                className="text-left py-2 px-3 font-medium text-gray-300 cursor-pointer hover:bg-white/5 transition-colors w-20"
                onClick={() => handleSort('type')}
              >
                <div className="flex items-center space-x-1">
                  <span>Type</span>
                  <SortIcon field="type" />
                </div>
              </th>
              <th 
                className="text-left py-2 px-3 font-medium text-gray-300 cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => handleSort('value')}
              >
                <div className="flex items-center space-x-1">
                  <span>Value</span>
                  <SortIcon field="value" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedHeaders.map((header) => {
              const isExpanded = expandedRows.has(header.key);
              const displayValue = header.truncated && !isExpanded 
                ? header.value.substring(0, 50) + '...' 
                : header.value;

              return (
                <tr key={header.key} className="border-b border-white/5 hover:bg-white/5 group">
                  <td className="py-2 px-3 font-mono text-blue-300 font-medium relative">
                    <div className="flex items-center justify-between">
                      <span>{header.key}</span>
                      <button
                        onClick={() => copyToClipboard(header.key, 'key')}
                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-all"
                        title="Copy key"
                      >
                        📋
                      </button>
                    </div>
                  </td>
                  <td className="py-2 px-3">
                    <span className={`px-2 py-0.5 text-xs rounded font-medium ${
                      header.type === 'string' ? 'bg-green-500/20 text-green-300' :
                      header.type === 'number' ? 'bg-blue-500/20 text-blue-300' :
                      header.type === 'boolean' ? 'bg-purple-500/20 text-purple-300' :
                      'bg-gray-500/20 text-gray-300'
                    }`}>
                      {header.type}
                    </span>
                  </td>
                  <td className="py-2 px-3 font-mono text-sm relative">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 flex-1 min-w-0">
                        <span 
                          className={`break-all ${header.truncated ? 'cursor-pointer text-gray-300 hover:text-white' : 'text-gray-200'}`}
                          onClick={() => header.truncated && toggleExpanded(header.key)}
                          title={header.truncated ? 'Click to expand/collapse' : ''}
                        >
                          {displayValue}
                        </span>
                        {header.truncated && (
                          <button
                            onClick={() => toggleExpanded(header.key)}
                            className="text-blue-400 hover:text-blue-300 text-xs flex-shrink-0"
                          >
                            {isExpanded ? 'Less' : 'More'}
                          </button>
                        )}
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 flex items-center space-x-1 transition-all">
                        <button
                          onClick={() => copyToClipboard(header.value, 'value')}
                          className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
                          title="Copy value"
                        >
                          📄
                        </button>
                        <button
                          onClick={() => copyToClipboard(`${header.key}: ${header.value}`, 'header')}
                          className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
                          title="Copy both"
                        >
                          📝
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function RequestDetailsPanel({
  isOpen,
  onClose,
  requestData,
  className = "",
}: RequestDetailsPanelProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "request" | "response" | "raw">("overview");

  if (!isOpen || !requestData) return null;

  const getStatusBadgeColor = (status?: number) => {
    if (!status) return "bg-gray-500/20 text-gray-300";
    if (status >= 200 && status < 300) return "bg-green-500/20 text-green-300";
    if (status >= 400 && status < 500) return "bg-yellow-500/20 text-yellow-300";
    if (status >= 500) return "bg-red-500/20 text-red-300";
    return "bg-gray-500/20 text-gray-300";
  };

  const requestDetails = {
    timestamp: requestData?.t ? new Date(requestData.t).toISOString() : "Unknown",
    method: requestData?.method || "GET",
    path: requestData?.path || "Unknown",
    status: requestData?.status,
    duration: requestData?.duration_ms,
    service: requestData?.service || "unknown",
    clientIp: requestData?.attrs?.clientIp || requestData?.attrs?.ip || "unknown",
    correlationId: requestData?.correlationId || "req-" + Math.random().toString(36).substr(2, 9),
  };

  // Extract headers from request data
  const requestHeaders = requestData?.headers || requestData?.attrs?.headers || {};
  const responseHeaders = requestData?.response?.headers || {};
  
  // Extract body data from request
  const requestBody = requestData?.body || requestData?.attrs?.body || null;
  const responseBody = requestData?.response?.body || requestData?.response || null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div className={`fixed inset-y-0 right-0 w-1/2 bg-gradient-to-br from-gray-800 to-gray-900 border-l border-white/10 shadow-2xl z-50 transform transition-transform duration-300 ${className}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-gray-900/80 backdrop-blur-sm">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs font-medium">
                {requestDetails.method}
              </span>
              <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusBadgeColor(requestDetails.status)}`}>
                {requestDetails.status || "—"}
              </span>
            </div>
            <h2 className="text-lg font-semibold text-white truncate max-w-md" title={requestDetails.path}>
              {requestDetails.path}
            </h2>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => copyToClipboard(window.location.href, 'URL')}
              className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              title="Copy current URL"
            >
              🔗
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              title="Close panel"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-2 p-4 bg-gray-900/50">
          <TabButton active={activeTab === "overview"} onClick={() => setActiveTab("overview")}>
            📊 Overview
          </TabButton>
          <TabButton active={activeTab === "request"} onClick={() => setActiveTab("request")}>
            📤 Request
          </TabButton>
          <TabButton active={activeTab === "response"} onClick={() => setActiveTab("response")}>
            📥 Response
          </TabButton>
          <TabButton active={activeTab === "raw"} onClick={() => setActiveTab("raw")}>
            🔍 Raw Data
          </TabButton>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto h-full">
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 rounded-lg p-4">
                  <div className="grid grid-cols-1 gap-3">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Timestamp:</span>
                      <div className="text-white font-mono text-sm">{requestDetails.timestamp}</div>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Service:</span>
                      <div className="text-white font-medium">{requestDetails.service}</div>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Correlation ID:</span>
                      <div className="text-white font-mono text-sm flex items-center space-x-2">
                        <span>{requestDetails.correlationId}</span>
                        <button
                          onClick={() => copyToClipboard(requestDetails.correlationId, 'Correlation ID')}
                          className="text-gray-400 hover:text-white text-xs"
                          title="Copy correlation ID"
                        >
                          📋
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white/5 rounded-lg p-4">
                  <div className="grid grid-cols-1 gap-3">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Duration:</span>
                      <div className="text-white font-medium">{requestDetails.duration ? `${requestDetails.duration}ms` : "—"}</div>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Client IP:</span>
                      <div className="text-white font-mono">{requestDetails.clientIp}</div>
                    </div>
                  </div>
                </div>
              </div>

              <HeadersTable headers={requestHeaders} title="Request Headers" />

              {requestDetails.status && requestDetails.status >= 400 && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                  <h3 className="text-md font-semibold text-red-300 mb-2">Error Information</h3>
                  <div className="text-sm text-red-200">
                    <div>Status: {requestDetails.status}</div>
                    <div>Error: {requestDetails.status === 500 ? "Internal Server Error" : "Request Failed"}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "request" && (
            <div className="space-y-6">
              <HeadersTable headers={requestHeaders} title="Request Headers" />

              {requestBody && (
                <div className="bg-white/5 rounded-lg p-4">
                  <h3 className="text-md font-semibold text-white mb-3">Request Body</h3>
                  <JsonViewer data={requestBody} />
                </div>
              )}

              <div className="bg-white/5 rounded-lg p-4">
                <h3 className="text-md font-semibold text-white mb-3">Query Parameters</h3>
                <JsonViewer data={requestData?.queryParams || requestData?.query || {}} />
              </div>
            </div>
          )}

          {activeTab === "response" && (
            <div className="space-y-6">
              <HeadersTable 
                headers={responseHeaders} 
                title="Response Headers" 
              />

              {responseBody && (
                <div className="bg-white/5 rounded-lg p-4">
                  <h3 className="text-md font-semibold text-white mb-3">Response Body</h3>
                  <JsonViewer data={responseBody} />
                </div>
              )}
            </div>
          )}

          {activeTab === "raw" && (
            <div className="space-y-6">
              <div className="bg-white/5 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-md font-semibold text-white">Raw Request Data</h3>
                  <button
                    onClick={() => copyToClipboard(JSON.stringify(requestData, null, 2), 'Raw data')}
                    className="px-3 py-1 bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 rounded text-sm transition-colors"
                  >
                    📋 Copy All
                  </button>
                </div>
                <JsonViewer data={requestData} />
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
