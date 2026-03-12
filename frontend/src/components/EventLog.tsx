import type { LogEntry } from "@/lib/types";

interface EventLogProps {
  entries: LogEntry[];
}

export function EventLog({ entries }: EventLogProps) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 col-span-full">
      <h2 className="text-sm text-gray-400 uppercase tracking-wider mb-4">
        Event Log
      </h2>
      <div className="max-h-64 overflow-y-auto font-mono text-xs leading-relaxed">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="py-1 border-b border-gray-800 last:border-b-0"
          >
            <span className="text-gray-500">[{entry.time}]</span>{" "}
            {entry.message}
          </div>
        ))}
      </div>
    </div>
  );
}
