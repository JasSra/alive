"use client";
import { useState, useRef, useEffect } from "react";
import styles from "./Toolbar.module.css";

interface ToolbarMenuProps {
  onRefresh: () => void;
  onClearData: () => void;
  isLoading?: boolean;
  isClearing?: boolean;
  className?: string;
}

export default function ToolbarMenu({ 
  onRefresh, 
  onClearData, 
  isLoading = false, 
  isClearing = false,
  className = ""
}: ToolbarMenuProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
        setShowClearConfirm(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleClearClick = () => {
    if (showClearConfirm) {
      onClearData();
      setShowClearConfirm(false);
      setIsMenuOpen(false);
    } else {
      setShowClearConfirm(true);
    }
  };

  const handleRefreshClick = () => {
    onRefresh();
    setIsMenuOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={menuRef}>
      {/* Menu trigger button */}
      <button
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        disabled={isLoading || isClearing}
        className={`
          flex items-center space-x-2 px-4 py-2 rounded-lg font-medium 
          transition-all duration-200 shadow-sm
          ${isMenuOpen 
            ? 'bg-slate-700 text-white border border-slate-600' 
            : 'bg-slate-800/60 text-slate-300 border border-slate-700/50 hover:bg-slate-700/60 hover:text-white'
          }
          ${(isLoading || isClearing) ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        aria-label="Actions menu"
      >
        <span className="text-sm">⚙️</span>
        <span>Actions</span>
        <svg 
          className={`w-4 h-4 transition-transform duration-200 ${isMenuOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {isMenuOpen && (
        <div className={`
          absolute top-full right-0 mt-2 w-56 z-[50001]
          bg-slate-800/95 backdrop-blur-lg rounded-lg border border-slate-700/50 
          shadow-xl shadow-black/20 overflow-hidden
          ${styles.dropdownMenu}
        `}>
          {/* Refresh option */}
          <button
            onClick={handleRefreshClick}
            disabled={isLoading || isClearing}
            className={`
              w-full flex items-center space-x-3 px-4 py-3 text-left
              hover:bg-slate-700/50 transition-colors duration-150
              ${(isLoading || isClearing) ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-blue-600/20 ${isLoading ? 'animate-pulse' : ''}`}>
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin"></div>
              ) : (
                <span className="text-blue-400">🔄</span>
              )}
            </div>
            <div className="flex-1">
              <div className="text-white font-medium">
                {isLoading ? 'Refreshing...' : 'Refresh Data'}
              </div>
              <div className="text-slate-400 text-xs">
                {isLoading ? 'Fetching latest requests' : 'Reload all request data'}
              </div>
            </div>
          </button>

          {/* Divider */}
          <div className="border-t border-slate-700/50 my-1"></div>

          {/* Clear data option */}
          <button
            onClick={handleClearClick}
            disabled={isLoading || isClearing}
            className={`
              w-full flex items-center space-x-3 px-4 py-3 text-left
              transition-colors duration-150
              ${showClearConfirm 
                ? 'bg-red-600/20 hover:bg-red-600/30' 
                : 'hover:bg-slate-700/50'
              }
              ${(isLoading || isClearing) ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              showClearConfirm 
                ? 'bg-red-600/30' 
                : isClearing 
                  ? 'bg-red-600/20 animate-pulse' 
                  : 'bg-red-600/20'
            }`}>
              {isClearing ? (
                <div className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin"></div>
              ) : showClearConfirm ? (
                <span className="text-red-400">⚠️</span>
              ) : (
                <span className="text-red-400">🗑️</span>
              )}
            </div>
            <div className="flex-1">
              <div className={`font-medium ${showClearConfirm ? 'text-red-300' : 'text-white'}`}>
                {isClearing 
                  ? 'Clearing Data...' 
                  : showClearConfirm 
                    ? 'Confirm Delete?' 
                    : 'Clear All Data'
                }
              </div>
              <div className="text-slate-400 text-xs">
                {isClearing 
                  ? 'Deleting all stored requests' 
                  : showClearConfirm 
                    ? 'This action cannot be undone' 
                    : 'Delete all stored request data'
                }
              </div>
            </div>
            {showClearConfirm && (
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
                <span className="text-red-300 text-xs font-medium">Click to confirm</span>
              </div>
            )}
          </button>

          {showClearConfirm && (
            <>
              <div className="border-t border-slate-700/50 my-1"></div>
              <button
                onClick={() => {
                  setShowClearConfirm(false);
                  setIsMenuOpen(false);
                }}
                disabled={isClearing}
                className="w-full flex items-center space-x-3 px-4 py-2 text-left hover:bg-slate-700/50 transition-colors duration-150"
              >
                <div className="w-6 h-6 rounded flex items-center justify-center bg-slate-600/20">
                  <span className="text-slate-400 text-sm">✕</span>
                </div>
                <div className="text-slate-300 text-sm">Cancel</div>
              </button>
            </>
          )}

          {/* Menu footer */}
          <div className="border-t border-slate-700/50 px-4 py-2">
            <div className="text-xs text-slate-500 text-center">
              Actions • Request Management
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
