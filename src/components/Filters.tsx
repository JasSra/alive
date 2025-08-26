"use client";
import { Fragment, memo, useEffect, useState } from "react";
import { Listbox, Transition } from "@headlessui/react";

interface Option { value: string; label: string }
interface FiltersProps {
  range: string;
  onRangeChange: (v: string) => void;
}

const ranges: Option[] = [
  { value: "5m", label: "T-5M (Last 5 minutes)" },
  { value: "20m", label: "T-20M (Last 20 minutes)" },
  { value: "1h", label: "T-1H (Last hour)" },
  { value: "6h", label: "T-6H (Last 6 hours)" },
  { value: "24h", label: "T-24H (Last 24 hours)" },
  { value: "7d", label: "T-7D (Last 7 days)" },
];

const Filters = memo(function Filters({ range, onRangeChange }: FiltersProps) {
  const selected = ranges.find((r) => r.value === range) ?? ranges[0];
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isClient, setIsClient] = useState(false);
  
  // Set client flag after hydration
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  // Update current time every second for live indicator
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  
  // Format time consistently for server and client
  const formatTime = (date: Date) => {
    return date.toTimeString().slice(0, 8); // HH:MM:SS format
  };
  
  // Check if this is a short-term T-pattern range (more "live")
  const isLiveRange = ['5m', '20m', '1h'].includes(range);
  
  return (
    <div className="flex items-center gap-3" role="group" aria-label="Filters">
      <Listbox value={selected} onChange={(opt) => onRangeChange(opt.value)}>
        <div className="relative min-w-40">
          <Listbox.Button className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-left flex items-center gap-2">
            {isLiveRange && (
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" title="Live time window" />
            )}
            {selected.label}
          </Listbox.Button>
          <Transition as={Fragment} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
            <Listbox.Options className="absolute z-20 mt-1 w-full rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow focus:outline-none">
              {ranges.map((opt) => (
                <Listbox.Option key={opt.value} value={opt} className={({ active }) => `cursor-pointer px-3 py-2 text-sm flex items-center gap-2 ${active ? "bg-neutral-100 dark:bg-neutral-800" : ""}`}>
                  {['5m', '20m', '1h'].includes(opt.value) && (
                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                  )}
                  {opt.label}
                </Listbox.Option>
              ))}
            </Listbox.Options>
          </Transition>
        </div>
      </Listbox>
      
      {/* Live time indicator */}
      {isLiveRange && isClient && (
        <div className="text-xs text-neutral-400 font-mono flex items-center gap-1">
          <span className="w-1 h-1 bg-emerald-400 rounded-full animate-pulse" />
          T-{formatTime(currentTime)}
        </div>
      )}
    </div>
  );
});

export default Filters;
