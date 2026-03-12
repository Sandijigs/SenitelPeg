import { SEV_CONFIG, type Severity } from "@/lib/constants";

interface FeeCardProps {
  severity: Severity;
}

export function FeeCard({ severity }: FeeCardProps) {
  const config = SEV_CONFIG[severity];

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <h2 className="text-sm text-gray-400 uppercase tracking-wider mb-4">
        Active Fee Tier
      </h2>
      <div className="text-3xl font-bold">{config.feePct}</div>
      <div className="h-2 rounded bg-gray-800 mt-3 overflow-hidden">
        <div
          className={`h-full rounded transition-all duration-400 ${config.barColor}`}
          style={{ width: config.barWidth }}
        />
      </div>
      <p className="mt-2 text-gray-500 text-xs">
        {config.feeBps.toLocaleString()} / 1,000,000
      </p>
    </div>
  );
}
