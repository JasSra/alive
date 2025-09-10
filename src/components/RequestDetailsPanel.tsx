"use client";
import { useState } from "react";
import JsonViewer from "./JsonViewer";

interface RequestData {
  t?: string | number;
  method?: string;
  path?: string;
  status?: number;
  duration_ms?: number;
  service?: string;
  correlationId?: string;
  attrs?: {
    clientIp?: string;
    ip?: string;
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
  };

  const mockRequestHeaders = {
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "accept": "application/json, text/plain, */*",
    "accept-language": "en-US,en;q=0.9",
    "authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "content-type": "application/json",
    "x-correlation-id": requestData?.correlationId || "req-" + Math.random().toString(36).substr(2, 9),
  };

  const mockResponseHeaders = {
    "content-type": "application/json; charset=utf-8",
    "content-length": "1234",
    "x-powered-by": "Express",
    "access-control-allow-origin": "*",
    "x-response-time": `${requestData?.duration_ms || 150}ms`,
    "cache-control": "no-cache",
  };

  const mockRequestBody = requestData?.method === "POST" || requestData?.method === "PUT" ? {
    userId: "user-123",
    data: {
      name: "John Doe",
      email: "john.doe@example.com",
      preferences: {
        theme: "dark",
        notifications: true,
        timezone: "UTC"
      }
    },
    metadata: {
      source: "web-app",
      version: "1.2.3"
    }
  } : null;

  const mockResponseBody = {
    success: requestData?.status ? requestData.status < 400 : true,
    status: requestData?.status || 200,
    data: requestData?.status && requestData.status >= 400 ? null : {
      id: "res-" + Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      result: "Operation completed successfully",
      items: [
        { id: 1, name: "Item 1", active: true },
        { id: 2, name: "Item 2", active: false },
      ]
    },
    error: requestData?.status && requestData.status >= 400 ? {
      code: `ERR_${requestData.status}`,
      message: requestData.status === 500 ? "Internal server error" : "Request failed",
      details: "Additional error details would be here"
    } : null,
    meta: {
      requestId: requestData?.correlationId || "req-" + Math.random().toString(36).substr(2, 9),
      processingTime: requestData?.duration_ms || 150,
      serverTime: new Date().toISOString()
    }
  };

  return (
    <div className={`fixed inset-y-0 right-0 w-1/2 bg-gray-800 border-l border-white/10 shadow-2xl z-50 transform transition-transform duration-300 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10 bg-gray-900/50">
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
        <button
          onClick={onClose}
          className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/10"
          title="Close details panel"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 p-4 border-b border-white/10 bg-gray-900/30">
        <TabButton active={activeTab === "overview"} onClick={() => setActiveTab("overview")}>
          Overview
        </TabButton>
        <TabButton active={activeTab === "request"} onClick={() => setActiveTab("request")}>
          Request
        </TabButton>
        <TabButton active={activeTab === "response"} onClick={() => setActiveTab("response")}>
          Response
        </TabButton>
        <TabButton active={activeTab === "raw"} onClick={() => setActiveTab("raw")}>
          Raw Data
        </TabButton>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {activeTab === "overview" && (
          <div className="space-y-4">
            <div className="bg-white/5 rounded-lg p-4">
              <h3 className="text-md font-semibold text-white mb-3">Request Summary</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">Timestamp:</span>
                  <div className="text-white font-mono">{requestDetails.timestamp}</div>
                </div>
                <div>
                  <span className="text-gray-400">Duration:</span>
                  <div className="text-white font-mono">{requestDetails.duration ? `${requestDetails.duration}ms` : "—"}</div>
                </div>
                <div>
                  <span className="text-gray-400">Service:</span>
                  <div className="text-white">{requestDetails.service}</div>
                </div>
                <div>
                  <span className="text-gray-400">Client IP:</span>
                  <div className="text-white font-mono">{requestDetails.clientIp}</div>
                </div>
              </div>
            </div>

            <div className="bg-white/5 rounded-lg p-4">
              <h3 className="text-md font-semibold text-white mb-3">Request Headers</h3>
              <JsonViewer data={mockRequestHeaders} />
            </div>

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
          <div className="space-y-4">
            <div className="bg-white/5 rounded-lg p-4">
              <h3 className="text-md font-semibold text-white mb-3">Request Headers</h3>
              <JsonViewer data={mockRequestHeaders} />
            </div>

            {mockRequestBody && (
              <div className="bg-white/5 rounded-lg p-4">
                <h3 className="text-md font-semibold text-white mb-3">Request Body</h3>
                <JsonViewer data={mockRequestBody} />
              </div>
            )}

            <div className="bg-white/5 rounded-lg p-4">
              <h3 className="text-md font-semibold text-white mb-3">Query Parameters</h3>
              <JsonViewer data={{ 
                limit: "10", 
                offset: "0", 
                filter: "active",
                sort: "created_at:desc" 
              }} />
            </div>
          </div>
        )}

        {activeTab === "response" && (
          <div className="space-y-4">
            <div className="bg-white/5 rounded-lg p-4">
              <h3 className="text-md font-semibold text-white mb-3">Response Headers</h3>
              <JsonViewer data={mockResponseHeaders} />
            </div>

            <div className="bg-white/5 rounded-lg p-4">
              <h3 className="text-md font-semibold text-white mb-3">Response Body</h3>
              <JsonViewer data={mockResponseBody} />
            </div>
          </div>
        )}

        {activeTab === "raw" && (
          <div className="space-y-4">
            <div className="bg-white/5 rounded-lg p-4">
              <h3 className="text-md font-semibold text-white mb-3">Raw Request Data</h3>
              <JsonViewer data={requestData} />
            </div>

            <div className="bg-white/5 rounded-lg p-4">
              <h3 className="text-md font-semibold text-white mb-3">Full Request Object</h3>
              <pre className="text-xs text-gray-300 bg-black/20 rounded p-3 overflow-auto max-h-64">
                {JSON.stringify(requestData, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
