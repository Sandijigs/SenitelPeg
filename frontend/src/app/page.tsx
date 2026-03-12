"use client";

import { useState, useCallback } from "react";
import { Header } from "@/components/Header";
import { ConnectWallet } from "@/components/ConnectWallet";
import { SeverityCard } from "@/components/SeverityCard";
import { FeeCard } from "@/components/FeeCard";
import { SimulationCard } from "@/components/SimulationCard";
import { EventLog } from "@/components/EventLog";
import { useWallet } from "@/lib/useWallet";
import { SEV_CONFIG, type Severity } from "@/lib/constants";
import type { LogEntry } from "@/lib/types";

export default function Dashboard() {
  const [severity, setSeverity] = useState<Severity>(0);
  const [driftBps, setDriftBps] = useState(0);
  const [isStale, setIsStale] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: "startup",
      time: "startup",
      message:
        "Dashboard loaded. Connect wallet to interact with on-chain hook.",
    },
  ]);

  const addLog = useCallback((message: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [{ id: crypto.randomUUID(), time, message }, ...prev]);
  }, []);

  const { address, connect, simulateOnChain } = useWallet(addLog);

  const handleSimulate = useCallback(
    async (sev: Severity, drift: number) => {
      setSeverity(sev);
      setDriftBps(drift);
      setIsStale(false);
      addLog(
        `Simulated \u2192 ${SEV_CONFIG[sev].label} (drift: ${(drift / 100).toFixed(2)}%)`,
      );

      // If wallet is connected, also send the tx on-chain
      await simulateOnChain(sev, drift);
    },
    [addLog, simulateOnChain],
  );

  const handleConnect = useCallback(async () => {
    const state = await connect();
    if (state) {
      setSeverity(state.severity as Severity);
      setDriftBps(state.driftBps);
      setIsStale(state.isStale);
    }
  }, [connect]);

  return (
    <main className="p-8">
      <Header />
      <ConnectWallet address={address} onConnect={handleConnect} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-[900px] mx-auto">
        <SeverityCard
          severity={severity}
          driftBps={driftBps}
          isStale={isStale}
        />
        <FeeCard severity={severity} />
        <SimulationCard onSimulate={handleSimulate} />
        <EventLog entries={logs} />
      </div>
    </main>
  );
}
