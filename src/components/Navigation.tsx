"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  description: string;
  badge?: string;
}

interface DropdownItem {
  href: string;
  label: string;
  icon: string;
  description: string;
  external?: boolean;
}

const navigationItems: NavItem[] = [
  {
    href: "/requests",
    label: "Requests",
    icon: "🌐",
    description: "HTTP requests & responses",
    badge: "req/res"
  },
  {
    href: "/logs", 
    label: "Logs",
    icon: "📝",
    description: "Application logs & events",
    badge: "logs"
  },
  {
    href: "/events",
    label: "Events",
    icon: "⚡",
    description: "Live events & streaming",
    badge: "live"
  }
];

const resourceItems: DropdownItem[] = [
  {
    href: "/api/monitor.js",
    label: "JavaScript SDK",
    icon: "📜",
    description: "Browser monitoring script",
    external: true
  },
  {
    href: "/api/csharp-telemetry",
    label: "C# OTLP Integration",
    icon: "⚙️", 
    description: "Modern .NET telemetry code",
    external: true
  }
];

export default function Navigation() {
  const pathname = usePathname();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isResourcesOpen, setIsResourcesOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsResourcesOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <nav className="bg-gradient-to-r from-slate-900/95 via-gray-900/95 to-slate-800/95 backdrop-blur-md border-b border-white/20 fixed top-0 left-0 right-0 z-50 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo/Brand */}
          <div className="flex items-center space-x-4">
            <Link href="/" className="flex items-center space-x-2 group">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110">
                <span className="text-white font-bold text-sm">A</span>
              </div>
              <span className="text-xl font-bold text-white">Alive</span>
            </Link>
            <div className="h-6 w-px bg-white/20"></div>
            <span className="text-sm text-gray-400">Observability Dashboard</span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {navigationItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 group ${
                    isActive
                      ? "bg-white/10 text-white shadow-lg"
                      : "text-gray-300 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">{item.icon}</span>
                    <span>{item.label}</span>
                    {item.badge && (
                      <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                        isActive 
                          ? "bg-white/20 text-white" 
                          : "bg-gray-600/50 text-gray-300 group-hover:bg-gray-500/50"
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </div>
                  {isActive && (
                    <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full"></div>
                  )}
                </Link>
              );
            })}
            
            {/* Resources Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsResourcesOpen(!isResourcesOpen)}
                className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 group ${
                  isResourcesOpen
                    ? "bg-white/10 text-white shadow-lg"
                    : "text-gray-300 hover:text-white hover:bg-white/5"
                }`}
              >
                <div className="flex items-center space-x-2">
                  <span className="text-lg">🔗</span>
                  <span>Resources</span>
                  <svg 
                    className={`w-4 h-4 transition-transform duration-200 ${isResourcesOpen ? 'rotate-180' : ''}`}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {/* Dropdown Menu */}
              {isResourcesOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-gray-800/95 backdrop-blur-md rounded-lg shadow-xl border border-white/20">
                  <div className="py-2">
                    {resourceItems.map((item) => (
                      <a
                        key={item.href}
                        href={item.href}
                        target={item.external ? "_blank" : undefined}
                        rel={item.external ? "noopener noreferrer" : undefined}
                        className="group flex items-center px-4 py-3 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors duration-200"
                        onClick={() => setIsResourcesOpen(false)}
                      >
                        <span className="text-lg mr-3">{item.icon}</span>
                        <div className="flex-1">
                          <div className="font-medium">{item.label}</div>
                          <div className="text-xs text-gray-400 group-hover:text-gray-300">{item.description}</div>
                        </div>
                        {item.external && (
                          <svg className="w-4 h-4 ml-2 opacity-50 group-hover:opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        )}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Mobile Navigation Button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              title="Toggle navigation menu"
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>

          {/* Status Indicator */}
          <div className="hidden sm:flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-sm text-gray-400">Live</span>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {isExpanded && (
          <div className="md:hidden pb-4 border-t border-white/10 mt-4">
            <div className="space-y-2 pt-4">
              {navigationItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsExpanded(false)}
                    className={`block px-4 py-3 rounded-lg transition-all duration-200 ${
                      isActive
                        ? "bg-white/10 text-white"
                        : "text-gray-300 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-lg">{item.icon}</span>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">{item.label}</span>
                          {item.badge && (
                            <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                              isActive 
                                ? "bg-white/20 text-white" 
                                : "bg-gray-600/50 text-gray-300"
                            }`}>
                              {item.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">{item.description}</p>
                      </div>
                    </div>
                  </Link>
                );
              })}
              
              {/* Mobile Resources Section */}
              <div className="pt-4 border-t border-white/10">
                <div className="px-4 py-2">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Resources</h3>
                </div>
                {resourceItems.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    target={item.external ? "_blank" : undefined}
                    rel={item.external ? "noopener noreferrer" : undefined}
                    onClick={() => setIsExpanded(false)}
                    className="block px-4 py-3 rounded-lg transition-all duration-200 text-gray-300 hover:text-white hover:bg-white/5"
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-lg">{item.icon}</span>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">{item.label}</span>
                          {item.external && (
                            <svg className="w-3 h-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">{item.description}</p>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
