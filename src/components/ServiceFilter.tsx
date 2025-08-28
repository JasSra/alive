'use client';

import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faServer, faFilter, faSpinner, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';

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

interface ServiceFilterProps {
  selectedService?: string;
  onServiceChange: (service: string | undefined) => void;
  timeRange?: { from?: string; to?: string };
}

export default function ServiceFilter({ selectedService, onServiceChange, timeRange }: ServiceFilterProps) {
  const [services, setServices] = useState<ServiceStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

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
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch services');
        console.error('Error fetching services:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchServices();
  }, [timeRange]);

  const refetchServices = async () => {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch services');
      console.error('Error fetching services:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleServiceSelect = (serviceName: string | undefined) => {
    onServiceChange(serviceName === selectedService ? undefined : serviceName);
  };

  const getServiceStatusColor = (service: ServiceStats) => {
    if (service.errorRate && service.errorRate > 10) return 'text-red-500';
    if (service.errorRate && service.errorRate > 5) return 'text-yellow-500';
    return 'text-green-500';
  };

  const formatLastSeen = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <FontAwesomeIcon icon={faSpinner} className="text-blue-500 animate-spin" />
          <h3 className="text-sm font-medium text-gray-900">Loading Services...</h3>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-red-200 p-4">
        <div className="flex items-center gap-2 mb-2">
          <FontAwesomeIcon icon={faExclamationTriangle} className="text-red-500" />
          <h3 className="text-sm font-medium text-red-900">Error Loading Services</h3>
        </div>
        <p className="text-sm text-red-700">{error}</p>
        <button
          onClick={refetchServices}
          className="mt-2 text-sm text-blue-600 hover:text-blue-800"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <FontAwesomeIcon icon={faServer} className="text-blue-500" />
          <h3 className="text-sm font-medium text-gray-900">Services</h3>
          <span className="text-xs text-gray-500">({services.length})</span>
        </div>
        <div className="flex items-center gap-2">
          {selectedService && (
            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
              {selectedService}
            </span>
          )}
          <FontAwesomeIcon
            icon={faFilter}
            className={`text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-200">
          <div className="p-2 space-y-1 max-h-96 overflow-y-auto">
            {/* All Services Option */}
            <button
              onClick={() => handleServiceSelect(undefined)}
              className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                !selectedService
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'hover:bg-gray-100 text-gray-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">All Services</span>
                <span className="text-xs text-gray-500">
                  {services.reduce((sum, s) => sum + s.eventCount, 0)} events
                </span>
              </div>
            </button>

            {/* Individual Services */}
            {services.map((service) => (
              <button
                key={service.serviceName}
                onClick={() => handleServiceSelect(service.serviceName)}
                className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                  selectedService === service.serviceName
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <FontAwesomeIcon
                      icon={faServer}
                      className={getServiceStatusColor(service)}
                    />
                    <span className="font-medium">
                      {service.serviceName === 'unknown' ? 'Unknown Service' : service.serviceName}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {service.eventCount} events
                  </span>
                </div>
                
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>{service.uniqueEvents} unique</span>
                  {service.avgResponseTime && (
                    <span>{service.avgResponseTime}ms avg</span>
                  )}
                  {service.errorRate !== undefined && (
                    <span className={service.errorRate > 5 ? 'text-red-500' : ''}>
                      {service.errorRate.toFixed(1)}% errors
                    </span>
                  )}
                  <span>{formatLastSeen(service.lastSeen)}</span>
                </div>
                
                {service.topEvents.length > 0 && (
                  <div className="mt-1 text-xs text-gray-400">
                    Top: {service.topEvents.slice(0, 2).map(e => e.eventName).join(', ')}
                    {service.topEvents.length > 2 && '...'}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
