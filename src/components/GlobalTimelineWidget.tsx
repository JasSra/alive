"use client";

import { useState, useEffect } from 'react';
import { useGlobalTimeline } from '@/lib/globalTimeline';

interface GlobalTimelineWidgetProps {
  className?: string;
  compact?: boolean;
}

export default function GlobalTimelineWidget({ className = '', compact = false }: GlobalTimelineWidgetProps) {
  const { state, subscribe, getFilteredEvents, getAllCorrelations, setLiveMode, selectCorrelation } = useGlobalTimeline();
  const [localState, setLocalState] = useState(state);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribe(setLocalState);
    return unsubscribe;
  }, [subscribe]);

  const events = getFilteredEvents();
  const recentEvents = events.slice(-10);
  const correlations = getAllCorrelations();
  const topCorrelations = correlations.slice(0, 5);

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'request': return '🌐';
      case 'log': return '📝';
      case 'event': return '🎯';
      case 'metric': return '📊';
      case 'raw': return '📦';
      default: return '●';
    }
  };

  if (compact) {
    return (
      <div className={`relative ${className}`}>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-300 hover:text-white transition-colors"
        >
          <div className="flex items-center space-x-1">
            <div className={`w-2 h-2 rounded-full ${localState.isLive ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`}></div>
            <span>{events.length}</span>
          </div>
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>

        {showDropdown && (
          <div className="absolute top-full right-0 mt-2 w-80 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50">
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-white">Global Timeline</h3>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setLiveMode(!localState.isLive)}
                    className={`px-2 py-1 text-xs rounded ${
                      localState.isLive 
                        ? 'bg-green-600 text-white' 
                        : 'bg-gray-600 text-gray-300'
                    }`}
                  >
                    {localState.isLive ? 'Live' : 'Paused'}
                  </button>
                </div>
              </div>

              {/* Recent Events */}
              <div className="mb-4">
                <h4 className="text-xs font-medium text-gray-400 mb-2">Recent Events ({events.length})</h4>
                <div className="space-y-1">
                  {recentEvents.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center space-x-2 text-xs p-2 rounded bg-gray-700/50 hover:bg-gray-700 cursor-pointer"
                      onClick={() => {
                        if (event.correlationId) {
                          selectCorrelation(event.correlationId);
                        }
                        setShowDropdown(false);
                      }}
                    >
                      <span className="text-base">{getEventIcon(event.type)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-white truncate">{event.data.message}</div>
                        <div className="text-gray-400">{formatTime(event.timestamp)}</div>
                      </div>
                      {event.correlationId && (
                        <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Correlations */}
              {topCorrelations.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-gray-400 mb-2">Active Correlations</h4>
                  <div className="space-y-1">
                    {topCorrelations.map((correlation) => (
                      <div
                        key={correlation.id}
                        className="flex items-center justify-between p-2 rounded bg-blue-900/30 hover:bg-blue-900/50 cursor-pointer text-xs"
                        onClick={() => {
                          selectCorrelation(correlation.id);
                          setShowDropdown(false);
                        }}
                      >
                        <div className="text-blue-300 truncate flex-1">
                          {correlation.id.length > 20 
                            ? `${correlation.id.substring(0, 20)}...`
                            : correlation.id
                          }
                        </div>
                        <div className="text-blue-200 ml-2">{correlation.count}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`bg-gray-800 border border-gray-700 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Global Timeline</h2>
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${localState.isLive ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`}></div>
          <span className="text-sm text-gray-300">{localState.isLive ? 'Live' : 'Paused'}</span>
          <button
            onClick={() => setLiveMode(!localState.isLive)}
            className="px-3 py-1 text-sm rounded bg-blue-600 hover:bg-blue-700 text-white"
          >
            {localState.isLive ? 'Pause' : 'Resume'}
          </button>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-gray-700/50 rounded p-3">
          <div className="text-2xl font-bold text-white">{events.length}</div>
          <div className="text-sm text-gray-400">Total Events</div>
        </div>
        <div className="bg-gray-700/50 rounded p-3">
          <div className="text-2xl font-bold text-blue-400">{correlations.length}</div>
          <div className="text-sm text-gray-400">Correlations</div>
        </div>
      </div>

      {/* Recent Events Timeline */}
      <div className="mb-4">
        <h3 className="text-sm font-medium text-gray-300 mb-2">Recent Activity</h3>
        <div className="space-y-2">
          {recentEvents.map((event, index) => (
            <div
              key={event.id}
              className="flex items-center space-x-3 p-2 rounded hover:bg-gray-700/50 cursor-pointer"
              onClick={() => {
                if (event.correlationId) {
                  selectCorrelation(event.correlationId);
                }
              }}
            >
              <div className="flex-shrink-0">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: event.color }}
                ></div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white truncate">{event.data.message}</div>
                <div className="text-xs text-gray-400">
                  {formatTime(event.timestamp)} • {event.service || 'unknown'}
                </div>
              </div>
              {event.correlationId && (
                <div className="flex-shrink-0">
                  <div className="px-2 py-1 text-xs bg-blue-600/30 text-blue-300 rounded">
                    {event.correlationId.substring(0, 8)}...
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Top Correlations */}
      {topCorrelations.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-300 mb-2">Active Correlations</h3>
          <div className="space-y-2">
            {topCorrelations.map((correlation) => (
              <div
                key={correlation.id}
                className="flex items-center justify-between p-2 rounded bg-blue-900/20 hover:bg-blue-900/30 cursor-pointer"
                onClick={() => selectCorrelation(correlation.id)}
              >
                <div className="text-sm text-blue-300 truncate flex-1">
                  {correlation.id}
                </div>
                <div className="text-sm text-blue-200 ml-2">
                  {correlation.count} events
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}