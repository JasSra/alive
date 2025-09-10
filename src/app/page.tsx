"use client";
import Header from "@/components/Header";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFileLines, faRightLeft, faBolt, faNetworkWired } from "@fortawesome/free-solid-svg-icons";

export default function Page() {
  return (
    <div className="min-h-screen w-full flex flex-col bg-background text-foreground">
      <Header />
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-8">
        <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link href="/logs" className="group block bg-neutral-900 border border-neutral-800 rounded-xl p-6 hover:border-amber-500/60 transition-colors">
            <div className="flex items-center gap-3 mb-2">
              <FontAwesomeIcon icon={faFileLines} className="text-amber-400 text-xl" />
              <h2 className="text-xl font-semibold">Logs</h2>
            </div>
            <p className="text-neutral-400">Stream and inspect raw events/logs in real time or from a time range.</p>
          </Link>

          <Link href="/requests" className="group block bg-neutral-900 border border-neutral-800 rounded-xl p-6 hover:border-blue-500/60 transition-colors">
            <div className="flex items-center gap-3 mb-2">
              <FontAwesomeIcon icon={faNetworkWired} className="text-blue-400 text-xl" />
              <h2 className="text-xl font-semibold">Requests</h2>
            </div>
            <p className="text-neutral-400">Analyze incoming requests and track request activity and timing.</p>
          </Link>

          <Link href="/responses" className="group block bg-neutral-900 border border-neutral-800 rounded-xl p-6 hover:border-green-500/60 transition-colors">
            <div className="flex items-center gap-3 mb-2">
              <FontAwesomeIcon icon={faRightLeft} className="text-green-400 text-xl" />
              <h2 className="text-xl font-semibold">Responses</h2>
            </div>
            <p className="text-neutral-400">Inspect response status codes, timings, and end-to-end correlation.</p>
          </Link>

          <Link href="/events" className="group block bg-neutral-900 border border-neutral-800 rounded-xl p-6 hover:border-purple-500/60 transition-colors">
            <div className="flex items-center gap-3 mb-2">
              <FontAwesomeIcon icon={faBolt} className="text-purple-400 text-xl" />
              <h2 className="text-xl font-semibold">Live Events</h2>
            </div>
            <p className="text-neutral-400">Timeline and live event table focused on the event stream.</p>
          </Link>
        </div>
      </main>
    </div>
  );
}

