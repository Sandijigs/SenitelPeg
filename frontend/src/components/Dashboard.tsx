"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { SEV, DEPEG_SCENARIOS, type Severity } from "@/lib/constants";
import type { LogEntry, DepegState, ContractConfig, TokenBalances } from "@/lib/types";

function LogMessage({ text }: { text: string }) {
  const parts = text.split(/(https:\/\/[^\s]+)/g);
  if (parts.length === 1) return <>{text}</>;
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("https://") ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer"
            className="text-blue-400/70 hover:text-blue-400 underline underline-offset-2">
            View tx
          </a>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function formatFee(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

function timeAgo(updatedAt: number): string {
  if (updatedAt === 0) return "never";
  const ago = Math.floor(Date.now() / 1000) - updatedAt;
  if (ago < 60) return `${ago}s ago`;
  if (ago < 3600) return `${Math.floor(ago / 60)}m ago`;
  return `${Math.floor(ago / 3600)}h ago`;
}

interface DashboardProps {
  isOwner: boolean;
  config: ContractConfig | null;
  depeg: DepegState | null;
  logs: LogEntry[];
  balances: TokenBalances | null;
  swapping: boolean;
  minting: boolean;
  triggerStateChange: (severity: Severity, driftBps: number) => Promise<DepegState | null>;
  refreshState: () => Promise<void>;
  mintTestTokens: () => Promise<void>;
  executeSwap: (zeroForOne: boolean, amount: string) => Promise<boolean>;
}

export function Dashboard({
  isOwner,
  config,
  depeg,
  logs,
  balances,
  swapping,
  minting,
  triggerStateChange,
  refreshState,
  mintTestTokens,
  executeSwap,
}: DashboardProps) {
  const [activeTx, setActiveTx] = useState<Severity | null>(null);
  const [zeroForOne, setZeroForOne] = useState(true);
  const [swapAmount, setSwapAmount] = useState("10");
  const [balanceFlash, setBalanceFlash] = useState(false);
  const prevBalRef = useRef<string | null>(null);

  // Flash the balance cards when balances change
  useEffect(() => {
    const key = balances ? `${balances.token0}|${balances.token1}` : null;
    if (prevBalRef.current && key && key !== prevBalRef.current) {
      setBalanceFlash(true);
      const t = setTimeout(() => setBalanceFlash(false), 1500);
      return () => clearTimeout(t);
    }
    prevBalRef.current = key;
  }, [balances]);

  const handleTrigger = useCallback(
    async (sev: Severity, drift: number) => {
      setActiveTx(sev);
      try {
        await triggerStateChange(sev, drift);
      } finally {
        setActiveTx(null);
      }
    },
    [triggerStateChange],
  );

  const severity = (depeg?.severity ?? 0) as Severity;
  const c = SEV[severity];
  const feeBps = depeg?.currentFeeBps ?? 0;
  const maxFeeBps = config?.feeCritical ?? 50000;
  const feeBarPct = maxFeeBps > 0 ? Math.min((feeBps / maxFeeBps) * 100, 100) : 0;

  return (
    <section id="dashboard" className="py-24 px-6">
      <div className="max-w-4xl mx-auto">

        {/* ── Current State ── */}
        <div
          className="rounded-2xl border border-white/[0.04] p-8 mb-6 transition-all duration-500"
          style={{
            background: "var(--bg-card)",
            boxShadow: `0 0 80px -20px ${c.color}10`,
          }}
        >
          <div className="flex items-center justify-between mb-8">
            <p className="text-xs uppercase tracking-[0.15em] text-white/40">Current Status</p>
            <div className="flex items-center gap-3">
              {depeg && (
                <span className="text-xs font-mono text-white/30">updated {timeAgo(depeg.updatedAt)}</span>
              )}
              <button onClick={refreshState} className="text-white/25 hover:text-white/60 transition-colors" title="Refresh">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.183" />
                </svg>
              </button>
            </div>
          </div>

          {/* Severity + key numbers */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 sm:gap-10">
            {/* Severity badge */}
            <div className="flex items-center gap-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500"
                style={{ backgroundColor: `${c.color}15`, border: `1.5px solid ${c.color}30` }}
              >
                <div className="w-4 h-4 rounded-full transition-all duration-500" style={{ backgroundColor: c.color }} />
              </div>
              <div>
                <div className="text-2xl font-bold transition-colors duration-500" style={{ color: c.color }}>
                  {c.label}
                </div>
                <p className="text-sm text-white/40">{c.tag}</p>
              </div>
            </div>

            {/* Key metrics */}
            <div className="flex flex-wrap gap-x-8 gap-y-4">
              <div>
                <p className="text-xs text-white/35 mb-1">Swap Fee</p>
                <p className="text-xl font-mono font-semibold transition-colors duration-500" style={{ color: c.color }}>
                  {formatFee(feeBps)}
                </p>
              </div>
              <div>
                <p className="text-xs text-white/35 mb-1">Price Drift</p>
                <p className="text-xl font-mono font-semibold text-white/80">
                  {depeg ? `${(depeg.driftBps / 100).toFixed(2)}%` : "0.00%"}
                </p>
              </div>
              <div>
                <p className="text-xs text-white/35 mb-1">LP Withdrawals</p>
                <p className={`text-xl font-semibold ${depeg?.liquidityLocked ? "text-red-400" : "text-emerald-400/80"}`}>
                  {depeg?.liquidityLocked ? "Blocked" : "Open"}
                </p>
              </div>
            </div>
          </div>

          {/* Fee bar */}
          <div className="mt-6 h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${feeBarPct}%`, backgroundColor: c.color }}
            />
          </div>

          {/* Alerts */}
          {depeg?.isStale && (
            <div className="mt-4 px-3 py-2 rounded-lg bg-amber-500/[0.06] border border-amber-500/10 text-sm text-amber-400/80">
              Data is stale — fallback fee ({config ? formatFee(config.feeStale) : "..."}) is active until new data arrives
            </div>
          )}
          {depeg?.liquidityLocked && (
            <div className="mt-4 px-3 py-2 rounded-lg bg-red-500/[0.08] border border-red-500/15 text-sm text-red-400/90">
              Critical depeg detected — LP withdrawals are blocked to protect liquidity
            </div>
          )}

          {/* Protected volume */}
          {depeg && depeg.totalProtectedVolume !== "0" && (
            <div className="mt-4 pt-4 border-t border-white/[0.04]">
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/35">Volume protected during depeg</span>
                <span className="text-sm font-mono text-emerald-400/80">
                  {(Number(depeg.totalProtectedVolume) / 1e18).toFixed(6)} ETH
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ── Swap Through Hook ── */}
        <div
          className="rounded-2xl border border-white/[0.04] p-8 mb-6"
          style={{ background: "var(--bg-card)" }}
        >
          <div className="mb-6">
            <p className="text-xs uppercase tracking-[0.15em] text-white/40 mb-2">
              Swap Tokens
            </p>
            <p className="text-sm text-white/30">
              Execute a real swap through the SentinelPeg hook. The dynamic fee applied depends on the current depeg severity.
            </p>
          </div>

          {/* Balances */}
          <div className="flex flex-wrap items-center gap-4 sm:gap-6 mb-6">
            <div className={`flex-1 rounded-xl p-4 transition-all duration-700 ${balanceFlash ? "bg-emerald-500/[0.08] border border-emerald-500/20" : "bg-white/[0.02] border border-white/[0.06]"}`}>
              <p className="text-xs text-white/35 mb-1">{balances?.token0Symbol ?? "spUSD"}</p>
              <p className={`text-lg font-mono font-semibold transition-colors duration-700 ${balanceFlash ? "text-emerald-400" : "text-white/80"}`}>
                {balances ? Number(balances.token0).toFixed(2) : "—"}
              </p>
            </div>
            <div className={`flex-1 rounded-xl p-4 transition-all duration-700 ${balanceFlash ? "bg-emerald-500/[0.08] border border-emerald-500/20" : "bg-white/[0.02] border border-white/[0.06]"}`}>
              <p className="text-xs text-white/35 mb-1">{balances?.token1Symbol ?? "spETH"}</p>
              <p className={`text-lg font-mono font-semibold transition-colors duration-700 ${balanceFlash ? "text-emerald-400" : "text-white/80"}`}>
                {balances ? Number(balances.token1).toFixed(2) : "—"}
              </p>
            </div>
            <button
              onClick={mintTestTokens}
              disabled={minting}
              className="shrink-0 px-4 py-3 rounded-xl text-sm font-medium border border-white/10 text-white/60 hover:text-white hover:border-white/20 transition-all disabled:opacity-40"
            >
              {minting ? "Minting..." : "Get Test Tokens"}
            </button>
          </div>

          {/* Swap controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-4">
            {/* Direction */}
            <div className="flex-1">
              <p className="text-xs text-white/35 mb-2">Direction</p>
              <button
                onClick={() => setZeroForOne(!zeroForOne)}
                className="w-full flex items-center justify-between rounded-xl bg-white/[0.02] border border-white/[0.06] px-4 py-3 hover:border-white/15 transition-colors"
              >
                <span className="text-sm text-white/70">
                  {zeroForOne ? `${balances?.token0Symbol ?? "spUSD"} → ${balances?.token1Symbol ?? "spETH"}` : `${balances?.token1Symbol ?? "spETH"} → ${balances?.token0Symbol ?? "spUSD"}`}
                </span>
                <svg className="w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                </svg>
              </button>
            </div>

            {/* Amount */}
            <div className="flex-1">
              <p className="text-xs text-white/35 mb-2">Amount</p>
              <input
                type="number"
                value={swapAmount}
                onChange={(e) => setSwapAmount(e.target.value)}
                min="0.001"
                step="1"
                className="w-full rounded-xl bg-white/[0.02] border border-white/[0.06] px-4 py-3 text-sm font-mono text-white/80 outline-none focus:border-white/20 transition-colors"
                placeholder="10"
              />
            </div>

            {/* Swap button */}
            <button
              onClick={async () => {
                const success = await executeSwap(zeroForOne, swapAmount);
                if (success) setSwapAmount("");
              }}
              disabled={swapping || !swapAmount || Number(swapAmount) <= 0}
              className="px-8 py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-400 hover:to-indigo-500 transition-all disabled:opacity-40 disabled:pointer-events-none"
            >
              {swapping ? "Swapping..." : "Swap"}
            </button>
          </div>

          {/* Current fee notice */}
          <div className="mt-4 flex items-center gap-2 text-sm">
            <span className="text-white/30">Current hook fee:</span>
            <span className="font-mono font-semibold" style={{ color: c.color }}>
              {formatFee(feeBps)}
            </span>
            {severity > 0 && (
              <span className="text-white/20">— elevated due to {c.label.toLowerCase()} depeg</span>
            )}
          </div>
          <p className="mt-3 text-xs text-white/20">
            Pool has limited testnet liquidity. Use amounts between 10–500 for best results.
          </p>
        </div>

        {/* ── Trigger Depeg Scenarios ── */}
        <div
          className="rounded-2xl border border-white/[0.04] p-8 mb-6"
          style={{ background: "var(--bg-card)" }}
        >
          <div className="mb-6">
            <p className="text-xs uppercase tracking-[0.15em] text-white/40 mb-2">
              Test Depeg Scenarios
            </p>
            <p className="text-sm text-white/30">
              {isOwner
                ? "Trigger real on-chain state changes to see how the hook responds at each severity level."
                : "Only the contract owner can trigger state changes. Connect with the owner wallet to test."}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {DEPEG_SCENARIOS.map(({ sev, drift, label }) => {
              const sc = SEV[sev];
              const isActive = activeTx === sev;
              const tierFee = config
                ? formatFee([config.feeNone, config.feeMild, config.feeSevere, config.feeCritical][sev])
                : null;
              return (
                <button
                  key={sev}
                  onClick={() => handleTrigger(sev, drift)}
                  disabled={!isOwner || activeTx !== null}
                  className={`group relative rounded-xl p-5 border text-left transition-all duration-200 hover:scale-[1.02] active:scale-[0.97] disabled:opacity-35 disabled:pointer-events-none ${isActive ? "scale-[0.97]" : ""}`}
                  style={{ borderColor: `${sc.color}15`, background: `${sc.color}05` }}
                >
                  <div className="w-3 h-3 rounded-full mb-3" style={{ backgroundColor: sc.color }} />
                  <div className="text-sm font-semibold mb-1" style={{ color: sc.color }}>{label}</div>
                  {tierFee && <div className="text-xs text-white/25">fee: {tierFee}</div>}
                  {isActive && (
                    <div className="absolute inset-0 rounded-xl border-2 animate-pulse" style={{ borderColor: sc.color }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Activity Log ── */}
        <div
          className="rounded-2xl border border-white/[0.04] p-8"
          style={{ background: "var(--bg-card)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs uppercase tracking-[0.15em] text-white/40">Activity Log</p>
            <span className="text-xs text-white/25 font-mono">{logs.length}</span>
          </div>
          <div className="max-h-64 overflow-y-auto scrollbar-thin space-y-1">
            {logs.length === 0 ? (
              <p className="text-sm text-white/25 py-4 text-center">Waiting for activity...</p>
            ) : (
              logs.map((entry, i) => (
                <div
                  key={entry.id}
                  className={`flex gap-3 py-1.5 px-2 rounded text-sm ${i === 0 ? "animate-slide-in-left" : ""}`}
                >
                  <span className="text-white/20 font-mono w-16 shrink-0 text-right">{entry.time}</span>
                  <span className="text-white/50">
                    <LogMessage text={entry.message} />
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </section>
  );
}
