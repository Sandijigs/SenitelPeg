"use client";

import { useState, useCallback } from "react";
import { useWallet } from "@/lib/useWallet";
import { SEV, SCENARIOS, type Severity } from "@/lib/constants";
import type { LogEntry } from "@/lib/types";

export function Dashboard() {
  const [severity, setSeverity] = useState<Severity>(0);
  const [driftBps, setDriftBps] = useState(0);
  const [isStale, setIsStale] = useState(false);
  const [activeSim, setActiveSim] = useState<Severity | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([
    { id: "init", time: "init", message: "Dashboard ready" },
  ]);

  const addLog = useCallback((message: string) => {
    const time = new Date().toLocaleTimeString("en-US", {
      hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
    setLogs((prev) => [{ id: crypto.randomUUID(), time, message }, ...prev]);
  }, []);

  const { address, connect, simulateOnChain } = useWallet(addLog);

  const handleSimulate = useCallback(
    async (sev: Severity, drift: number) => {
      setActiveSim(sev);
      setSeverity(sev);
      setDriftBps(drift);
      setIsStale(false);
      addLog(`${SEV[sev].label} (${(drift / 100).toFixed(1)}% drift, fee: ${SEV[sev].feePct})`);
      await simulateOnChain(sev, drift);
      setTimeout(() => setActiveSim(null), 500);
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

  const c = SEV[severity];

  return (
    <section id="dashboard" className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-12">
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/25 mb-3">Live Dashboard</p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
            See it in action
          </h2>
          <p className="text-sm text-white/30 max-w-lg mx-auto">
            {address
              ? "Connected to the deployed hook. Simulations send real transactions to Unichain Sepolia."
              : "Connect your wallet to send real transactions, or use demo mode to explore."}
          </p>
        </div>

        <div className="grid lg:grid-cols-12 gap-5">
          {/* ── Left column: Status cards ── */}
          <div className="lg:col-span-5 space-y-5">
            {/* Severity card */}
            <div
              className="rounded-2xl border border-white/[0.04] p-7 transition-all duration-500"
              style={{
                background: "var(--bg-card)",
                boxShadow: `0 0 80px -20px ${c.color}10`,
              }}
            >
              <p className="text-[11px] uppercase tracking-[0.15em] text-white/25 mb-6">Current State</p>

              <div className="flex items-center gap-5">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-500"
                  style={{
                    backgroundColor: `${c.color}12`,
                    border: `1.5px solid ${c.color}25`,
                  }}
                >
                  <div className="w-4 h-4 rounded-full transition-all duration-500" style={{ backgroundColor: c.color }} />
                </div>
                <div>
                  <div className="text-3xl font-bold tracking-tight transition-colors duration-500" style={{ color: c.color }}>
                    {c.label}
                  </div>
                  <p className="text-xs text-white/30 mt-0.5">{c.tag}</p>
                </div>
              </div>

              <div className="mt-7 pt-5 border-t border-white/[0.04] grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] text-white/20 uppercase tracking-wider mb-1">Drift</p>
                  <p className="text-xl font-mono font-semibold text-white/80">
                    {(driftBps / 100).toFixed(2)}%
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-white/20 uppercase tracking-wider mb-1">Active Fee</p>
                  <p className="text-xl font-mono font-semibold transition-colors duration-500" style={{ color: c.color }}>
                    {c.feePct}
                  </p>
                </div>
              </div>

              {/* Fee bar */}
              <div className="mt-5 h-2 rounded-full bg-white/[0.04] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${c.barPct}%`, backgroundColor: c.color }}
                />
              </div>

              {isStale && (
                <div className="mt-4 px-3 py-2 rounded-lg bg-amber-500/[0.06] border border-amber-500/10 text-xs text-amber-400/70 animate-fade-in">
                  Data is stale &mdash; conservative fees active
                </div>
              )}
            </div>

            {/* Wallet status */}
            {!address && (
              <button
                onClick={handleConnect}
                className="w-full py-4 rounded-2xl border border-white/[0.06] text-sm text-white/40 hover:text-white/70 hover:border-white/10 transition-all"
                style={{ background: "var(--bg-card)" }}
              >
                Connect wallet for on-chain transactions
              </button>
            )}
          </div>

          {/* ── Right column: Simulation + Log ── */}
          <div className="lg:col-span-7 space-y-5">
            {/* Simulation panel */}
            <div
              className="rounded-2xl border border-white/[0.04] p-7"
              style={{ background: "var(--bg-card)" }}
            >
              <div className="flex items-center justify-between mb-6">
                <p className="text-[11px] uppercase tracking-[0.15em] text-white/25">Simulate Scenario</p>
                <span className="text-[10px] px-2.5 py-1 rounded-full border border-white/[0.06] text-white/20">
                  {address ? "On-chain" : "Demo mode"}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {SCENARIOS.map(({ sev, drift, desc }) => {
                  const sc = SEV[sev];
                  const isActive = activeSim === sev;
                  return (
                    <button
                      key={sev}
                      onClick={() => handleSimulate(sev, drift)}
                      className={`group relative rounded-xl p-5 border text-left transition-all duration-200 hover:scale-[1.02] active:scale-[0.97] ${isActive ? "scale-[0.97]" : ""}`}
                      style={{
                        borderColor: `${sc.color}15`,
                        background: `${sc.color}05`,
                      }}
                    >
                      <div className="w-3 h-3 rounded-full mb-3 transition-transform group-hover:scale-125" style={{ backgroundColor: sc.color }} />
                      <div className="text-sm font-semibold mb-0.5" style={{ color: sc.color }}>
                        {sc.label}
                      </div>
                      <div className="text-[11px] text-white/20">{desc}</div>
                    </button>
                  );
                })}
              </div>

              <p className="text-[11px] text-white/15 mt-5">
                In production, state changes are triggered autonomously by Reactive Network callbacks.
              </p>
            </div>

            {/* Event log */}
            <div
              className="rounded-2xl border border-white/[0.04] p-7"
              style={{ background: "var(--bg-card)" }}
            >
              <div className="flex items-center justify-between mb-4">
                <p className="text-[11px] uppercase tracking-[0.15em] text-white/25">Event Log</p>
                <span className="text-[10px] text-white/15 font-mono">{logs.length}</span>
              </div>
              <div className="max-h-52 overflow-y-auto scrollbar-thin space-y-1">
                {logs.map((entry, i) => (
                  <div
                    key={entry.id}
                    className={`flex gap-3 py-1.5 px-2 rounded text-xs ${i === 0 ? "animate-slide-in-left" : ""}`}
                  >
                    <span className="text-white/10 font-mono w-14 shrink-0 text-right">{entry.time}</span>
                    <span className="text-white/40">{entry.message}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
