'use client';

import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faServer, faSpinner, faExclamationTriangle, faTimes, faCheck } from '@fortawesome/free-solid-svg-icons';

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

interface ServiceBadgesProps {
  selectedServices: string[];
  onServicesChange: (services: string[]) => void;
  timeRange?: { from?: string; to?: string };
  maxVisible?: number;
}

export default function ServiceBadges({ selectedServices, onServicesChange, timeRange, maxVisible = 8 }: ServiceBadgesProps) {
  const [services, setServices] = useState<ServiceStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

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
        console.error('Error fetching services:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchServices();
  }, [timeRange]);

  const getHealthStatus = (errorRate?: number) => {
    if (typeof errorRate !== 'number') return 'unknown';
    if (errorRate < 1) return 'healthy';
    if (errorRate < 5) return 'warning';
    return 'critical';
  };

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-500';
      case 'warning': return 'bg-yellow-500';
      case 'critical': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const handleServiceToggle = (serviceName: string) => {
    if (selectedServices.includes(serviceName)) {
      onServicesChange(selectedServices.filter(s => s !== serviceName));
    } else {
      onServicesChange([...selectedServices, serviceName]);
    }
  };

  const handleSelectAll = () => {
    onServicesChange(services.map(s => s.serviceName));
  };

  const handleClearAll = () => {
    onServicesChange([]);
  };

  const visibleServices = showAll ? services : services.slice(0, maxVisible);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-neutral-400">
        <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
        Loading services...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-sm text-red-400">
        <FontAwesomeIcon icon={faExclamationTriangle} />
        Error: {error}
      </div>
    );
  }

  if (services.length === 0) {
    return (
      <div className="text-sm text-neutral-500">
        No services found
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex items-center gap-2 text-xs">
        <button
          onClick={handleSelectAll}
          className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
        >
          <FontAwesomeIcon icon={faCheck} className="mr-1" />
          All
        </button>
        <button
          onClick={handleClearAll}
          className="px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded-md transition-colors"
        >
          <FontAwesomeIcon icon={faTimes} className="mr-1" />
          None
        </button>
        <span className="text-neutral-400">
          {selectedServices.length} of {services.length} selected
        </span>
      </div>

      {/* Service Badges */}
      <div className="flex flex-wrap gap-2">
        {visibleServices.map((service) => {
          const isSelected = selectedServices.includes(service.serviceName);
          const healthStatus = getHealthStatus(service.errorRate);
          const healthColor = getHealthColor(healthStatus);
          
          return (
            <button
              key={service.serviceName}
              onClick={() => handleServiceToggle(service.serviceName)}
              className={`
                relative inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all
                ${isSelected 
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25' 
                  : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                }
                border ${isSelected ? 'border-blue-500' : 'border-neutral-700'}
              `}
            >
              {/* Health indicator */}
              <div className={`w-2 h-2 rounded-full ${healthColor}`} />
              
              {/* Service icon */}
              <FontAwesomeIcon icon={faServer} className="w-3 h-3" />
              
              {/* Service name */}
              <span>{service.serviceName}</span>
              
              {/* Event count */}
              <span className={`
                text-xs px-1.5 py-0.5 rounded-full 
                ${isSelected 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-neutral-700 text-neutral-400'
                }
              `}>
                {service.eventCount}
              </span>
              
              {/* Selection indicator */}
              {isSelected && (
                <FontAwesomeIcon icon={faCheck} className="w-3 h-3 text-blue-200" />
              )}
            </button>
          );
        })}
        
        {/* Show more/less button */}
        {services.length > maxVisible && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="px-3 py-2 border border-dashed border-neutral-600 text-neutral-400 hover:text-neutral-300 hover:border-neutral-500 rounded-lg text-sm transition-colors"
          >
            {showAll ? `Show less` : `+${services.length - maxVisible} more`}
          </button>
        )}
      </div>
      
      {/* Selected services summary */}
      {selectedServices.length > 0 && (
        <div className="text-xs text-neutral-400">
          Filtering events from: {selectedServices.join(', ')}
        </div>
      )}
    </div>
  );
}
