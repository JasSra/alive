'use client';

import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faServer, 
  faClock, 
  faExclamationTriangle,
  faCheckCircle,
  faSpinner,
  faRefresh,
  faExpand 
} from '@fortawesome/free-solid-svg-icons';

interface ServiceStats {
  serviceName: string;
  eventCount: number;
  uniqueEvents: number;
  avgResponseTime?: number;
  errorRate?: number;
  lastSeen: string;
  topEvents: Array<{
    eventName: string;
    count: number;
    percentage: number;
  }>;
}

interface ServiceDashboardProps {
  selectedService?: string;
  selectedServices?: string[];
  timeRange?: { from?: string; to?: string };
  transport?: "sse" | "ws";
  live?: boolean;
}

export default function ServiceDashboard({ selectedService, selectedServices, timeRange, transport = "sse", live = false }: ServiceDashboardProps) {
  const [services, setServices] = useState<ServiceStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const params = new URLSearchParams();
        if (timeRange?.from) params.append('from', timeRange.from);
        if (timeRange?.to) params.append('to', timeRange.to);
        
        const response = await fetch(`/api/events/services?${params}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch services: ${response.statusText}`);
        }
        
        const data = await response.json();
        setServices(data.services || []);
        setLastUpdated(new Date());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch services');
        console.error('Error fetching services:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchServices();
    
    // Auto-refresh every 30 seconds, but only for SSE transport or when not in live mode
    // WebSocket provides real-time data, so no need for polling
    if (!live || transport === "sse") {
      const interval = setInterval(fetchServices, 30000);
      return () => clearInterval(interval);
    }
  }, [timeRange, transport, live]);

  const refresh = async () => {
    try {
      setError(null);
      
      const params = new URLSearchParams();
      if (timeRange?.from) params.append('from', timeRange.from);
      if (timeRange?.to) params.append('to', timeRange.to);
      
      const response = await fetch(`/api/events/services?${params}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch services: ${response.statusText}`);
      }
      
      const data = await response.json();
      setServices(data.services || []);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh services');
      console.error('Error refreshing services:', err);
    }
  };

  const getStatusIcon = (service: ServiceStats) => {
    if (service.errorRate && service.errorRate > 10) {
      return <FontAwesomeIcon icon={faExclamationTriangle} className="text-red-500" />;
    }
    if (service.errorRate && service.errorRate > 5) {
      return <FontAwesomeIcon icon={faExclamationTriangle} className="text-yellow-500" />;
    }
    return <FontAwesomeIcon icon={faCheckCircle} className="text-green-500" />;
  };

  const formatResponseTime = (ms?: number) => {
    if (!ms) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatLastSeen = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  // Support both single service (legacy) and multiple services (new)
  const activeServices = selectedServices || (selectedService ? [selectedService] : []);
  const filteredServices = activeServices.length > 0
    ? services.filter(s => activeServices.includes(s.serviceName))
    : services;

  if (loading && services.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-center">
          <FontAwesomeIcon icon={faSpinner} className="text-blue-500 animate-spin mr-2" />
          <span className="text-gray-600">Loading service metrics...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <FontAwesomeIcon icon={faServer} className="text-blue-500" />
              Service Metrics
              {activeServices.length > 0 && (
                <span className="text-sm px-2 py-1 bg-blue-100 text-blue-800 rounded">
                  {activeServices.length === 1 ? activeServices[0] : `${activeServices.length} services`}
                </span>
              )}
            </h2>
            {lastUpdated && (
              <p className="text-sm text-gray-500 mt-1">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </p>
            )}
          </div>
          <button
            onClick={refresh}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
          >
            <FontAwesomeIcon icon={faRefresh} className="text-xs" />
            Refresh
          </button>
        </div>
        
        {error && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      {/* Service Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredServices.map((service) => (
          <div key={service.serviceName} className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {getStatusIcon(service)}
                <h3 className="font-semibold text-gray-900">
                  {service.serviceName === 'unknown' ? 'Unknown Service' : service.serviceName}
                </h3>
              </div>
              <FontAwesomeIcon icon={faExpand} className="text-gray-400 text-xs" />
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="text-center p-2 bg-blue-50 rounded">
                <div className="text-lg font-bold text-blue-600">{service.eventCount}</div>
                <div className="text-xs text-blue-800">Total Events</div>
              </div>
              <div className="text-center p-2 bg-green-50 rounded">
                <div className="text-lg font-bold text-green-600">{service.uniqueEvents}</div>
                <div className="text-xs text-green-800">Unique Events</div>
              </div>
              <div className="text-center p-2 bg-purple-50 rounded">
                <div className="text-lg font-bold text-purple-600">
                  {formatResponseTime(service.avgResponseTime)}
                </div>
                <div className="text-xs text-purple-800">Avg Response</div>
              </div>
              <div className="text-center p-2 bg-red-50 rounded">
                <div className={`text-lg font-bold ${
                  service.errorRate && service.errorRate > 5 ? 'text-red-600' : 'text-green-600'
                }`}>
                  {service.errorRate?.toFixed(1) || '0.0'}%
                </div>
                <div className="text-xs text-red-800">Error Rate</div>
              </div>
            </div>

            {/* Last Seen */}
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
              <FontAwesomeIcon icon={faClock} className="text-xs" />
              <span>Last seen: {formatLastSeen(service.lastSeen)}</span>
            </div>

            {/* Top Events */}
            {service.topEvents.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Top Events</h4>
                <div className="space-y-1">
                  {service.topEvents.slice(0, 3).map((event) => (
                    <div key={event.eventName} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 truncate flex-1">{event.eventName}</span>
                      <div className="flex items-center gap-2 ml-2">
                        <span className="text-gray-500">{event.count}</span>
                        <div className="w-12 bg-gray-200 rounded-full h-1.5">
                          <div
                            className={`bg-blue-500 h-1.5 rounded-full`}
                            style={{ width: `${Math.min(event.percentage, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  {service.topEvents.length > 3 && (
                    <div className="text-xs text-gray-500 pt-1">
                      +{service.topEvents.length - 3} more events
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredServices.length === 0 && !loading && (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <FontAwesomeIcon icon={faServer} className="text-gray-400 text-3xl mb-3" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Services Found</h3>
          <p className="text-gray-600">
            {selectedServices && selectedServices.length > 0 
              ? `No data found for selected service${selectedServices.length > 1 ? 's' : ''}: ${selectedServices.join(', ')}`
              : 'No services are currently reporting events'
            }
          </p>
        </div>
      )}
    </div>
  );
}
