import { memo } from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
}

const StatCard = memo(function StatCard({ label, value, sublabel }: StatCardProps) {
  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4 bg-white dark:bg-neutral-900">
      <div className="text-xs text-neutral-500" aria-hidden>{label}</div>
      <div className="text-2xl font-semibold" aria-live="polite">{value}</div>
      {sublabel ? <div className="text-xs text-neutral-500 mt-1">{sublabel}</div> : null}
    </div>
  );
});

export default StatCard;
