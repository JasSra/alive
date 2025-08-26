"use client";
import Link from "next/link";
import { memo } from "react";

const Header = memo(function Header() {
  return (
    <header className="sticky top-0 z-10 backdrop-blur bg-background/60 border-b border-neutral-200 dark:border-neutral-800">
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between" role="navigation" aria-label="Primary">
        <Link href="/" className="font-semibold text-lg">Alive</Link>
        <nav className="flex items-center gap-4 text-sm" aria-label="Utility">
          <a href="/api/events/health" className="hover:underline">Health</a>
          <a href="https://github.com/" target="_blank" rel="noreferrer noopener" className="hover:underline">GitHub</a>
        </nav>
      </div>
    </header>
  );
});

export default Header;
