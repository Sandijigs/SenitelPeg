import { SEV_CONFIG, SIMULATION_SCENARIOS, type Severity } from "@/lib/constants";

interface SimulationCardProps {
  onSimulate: (severity: Severity, driftBps: number) => void;
}

const BUTTON_ICONS: Record<number, string> = {
  0: "\u2705",  // check mark
  1: "\u26A0\uFE0F",   // warning
  2: "\uD83D\uDD36",   // orange diamond
  3: "\uD83D\uDD34",   // red circle
};

export function SimulationCard({ onSimulate }: SimulationCardProps) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 col-span-full">
      <h2 className="text-sm text-gray-400 uppercase tracking-wider mb-2">
        Simulate Depeg Scenario
      </h2>
      <p className="text-gray-400 text-sm mb-4">
        Click a button to simulate a depeg state change on the hook.
        In production, these are triggered autonomously by Reactive Network.
      </p>
      <div className="flex flex-wrap gap-2">
        {SIMULATION_SCENARIOS.map(({ severity, driftBps }) => {
          const config = SEV_CONFIG[severity];
          return (
            <button
              key={severity}
              onClick={() => onSimulate(severity, driftBps)}
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition-opacity hover:opacity-85 ${config.btnClass}`}
            >
              {BUTTON_ICONS[severity]} {config.label}{" "}
              <span className="font-normal opacity-75">
                ({(driftBps / 100).toFixed(0)}% drift)
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
