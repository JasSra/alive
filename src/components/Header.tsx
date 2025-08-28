"use client";
import Link from "next/link";
import { memo, useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { 
  faHeartbeat, 
  faCode, 
  faCopy, 
  faDownload, 
  faCheck,
  faExternalLinkAlt 
} from "@fortawesome/free-solid-svg-icons";
import { faMoon, faSun } from "@fortawesome/free-solid-svg-icons";

const Header = memo(function Header() {
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  // Initialize from persisted preference
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = (localStorage.getItem("theme") as "light" | "dark" | null) ?? null;
    const initial = saved ?? (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? "dark" : "light");
    setTheme(initial);
    document.documentElement.classList.toggle("dark", initial === "dark");
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    if (typeof window !== "undefined") {
      document.documentElement.classList.toggle("dark", next === "dark");
      localStorage.setItem("theme", next);
    }
  };

  const handleCopySnippet = async () => {
    const code = `(function() {
  const script = document.createElement('script');
  script.src = '${window.location.origin}/api/monitor.js';
  script.onload = function() {
    console.log('✅ Live Network Monitor loaded successfully!');
    console.log('Monitor UI should appear in bottom-right corner');
  };
  script.onerror = function() {
    console.error('❌ Failed to load monitor script');
  };
  document.head.appendChild(script);
})();`;

    try {
      await navigator.clipboard.writeText(code);
      setCopiedSnippet(true);
      setTimeout(() => setCopiedSnippet(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleCopyScriptUrl = async () => {
    const url = `${window.location.origin}/api/monitor.js`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  return (
    <header className="sticky top-0 z-10 backdrop-blur bg-background/60 border-b border-neutral-200 dark:border-neutral-800">
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between" role="navigation" aria-label="Primary">
        <Link href="/" className="font-semibold text-lg flex items-center gap-2">
          <FontAwesomeIcon icon={faHeartbeat} className="text-green-500" />
          Alive
        </Link>
        <nav className="flex items-center gap-4 text-sm" aria-label="Utility">
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title={theme === "dark" ? "Switch to light" : "Switch to dark"}
          >
            <FontAwesomeIcon icon={theme === "dark" ? faSun : faMoon} className="text-gray-600 dark:text-gray-300" />
          </button>

          <a href="/api/events/health" className="hover:underline flex items-center gap-1">
            <FontAwesomeIcon icon={faHeartbeat} className="text-green-400" />
            Health
          </a>
          
          <div className="flex items-center gap-2">
            <a href="/api/monitor.js" target="_blank" className="hover:underline flex items-center gap-1">
              <FontAwesomeIcon icon={faCode} className="text-blue-400" />
              Monitor Script
              <FontAwesomeIcon icon={faExternalLinkAlt} className="text-xs opacity-60" />
            </a>
            <button 
              onClick={handleCopyScriptUrl}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="Copy script URL"
            >
              <FontAwesomeIcon 
                icon={copiedScript ? faCheck : faCopy} 
                className={`text-xs ${copiedScript ? 'text-green-500' : 'text-gray-500'}`} 
              />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-gray-600 dark:text-gray-400 flex items-center gap-1">
              <FontAwesomeIcon icon={faDownload} className="text-purple-400" />
              Dev Tools Snippet
            </span>
            <button 
              onClick={handleCopySnippet}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="Copy code snippet for dev tools"
            >
              <FontAwesomeIcon 
                icon={copiedSnippet ? faCheck : faCopy} 
                className={`text-xs ${copiedSnippet ? 'text-green-500' : 'text-gray-500'}`} 
              />
            </button>
          </div>

          {/* GitHub link removed for a cleaner header */}
        </nav>
      </div>
    </header>
  );
});

export default Header;
