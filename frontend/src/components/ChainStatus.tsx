"use client";

import { useState, useEffect } from "react";
import { HOOK_ADDRESS, REACTIVE_ADDRESS, CHAIN_ID, EXPLORER_URL, REACTIVE_EXPLORER } from "@/lib/constants";

interface ChainInfo {
  name: string;
  chainId: number | string;
  rpc: string;
  explorer: string;
  contract?: string;
  role: string;
  color: string;
}

const CHAINS: ChainInfo[] = [
  {
    name: "Ethereum Sepolia",
    chainId: 11155111,
    rpc: "https://rpc.sepolia.org",
    explorer: "https://sepolia.etherscan.io",
    role: "Origin — V2 Sync events monitored here",
    color: "#627eea",
  },
  {
    name: "Reactive Lasna",
    chainId: 5318007,
    rpc: "https://lasna-rpc.reactive.network",
    explorer: REACTIVE_EXPLORER,
    contract: REACTIVE_ADDRESS,
    role: "Processor — react() classifies severity",
    color: "#8b5cf6",
  },
  {
    name: "Unichain Sepolia",
    chainId: CHAIN_ID,
    rpc: "https://sepolia.unichain.org",
    explorer: EXPLORER_URL,
    contract: HOOK_ADDRESS,
    role: "Destination — v4 hook enforces fees",
    color: "#3b82f6",
  },
];

type Status = "checking" | "online" | "offline";

function useChainStatus(rpc: string): { status: Status; blockNumber: number | null } {
  const [status, setStatus] = useState<Status>("checking");
  const [blockNumber, setBlockNumber] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const res = await fetch(rpc, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 1 }),
          signal: AbortSignal.timeout(5000),
        });
        const data = await res.json();
        if (!cancelled) {
          if (data.result) {
            setStatus("online");
            setBlockNumber(parseInt(data.result, 16));
          } else {
            setStatus("offline");
          }
        }
      } catch {
        if (!cancelled) setStatus("offline");
      }
    }

    check();
    const interval = setInterval(check, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [rpc]);

  return { status, blockNumber };
}

function ChainCard({ chain }: { chain: ChainInfo }) {
  const { status, blockNumber } = useChainStatus(chain.rpc);

  const dotClass =
    status === "online"
      ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"
      : status === "offline"
        ? "bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.6)]"
        : "bg-amber-400 animate-pulse";

  return (
    <div
      className="rounded-2xl border border-white/[0.04] p-6 hover:border-white/[0.08] transition-all duration-300"
      style={{ background: "var(--bg-card)" }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold"
            style={{
              backgroundColor: `${chain.color}12`,
              border: `1px solid ${chain.color}25`,
              color: chain.color,
            }}
          >
            {chain.name.charAt(0)}
          </div>
          <div>
            <h4 className="text-base font-semibold">{chain.name}</h4>
            <p className="text-xs text-white/35">{chain.role}</p>
          </div>
        </div>
        <div className={`w-2.5 h-2.5 rounded-full ${dotClass}`} />
      </div>

      <div className="space-y-2.5 pt-4 border-t border-white/[0.04]">
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/35 uppercase tracking-wider">Chain ID</span>
          <span className="text-sm font-mono text-white/60">{chain.chainId}</span>
        </div>
        {blockNumber && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/35 uppercase tracking-wider">Block</span>
            <span className="text-sm font-mono text-white/60">{blockNumber.toLocaleString()}</span>
          </div>
        )}
        {chain.contract && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/35 uppercase tracking-wider">Contract</span>
            <a
              href={`${chain.explorer}/address/${chain.contract}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-mono text-blue-400/70 hover:text-blue-400 transition-colors"
            >
              {chain.contract.slice(0, 6)}...{chain.contract.slice(-4)}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export function ChainStatus() {
  return (
    <section id="chain-status" className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-xs uppercase tracking-[0.2em] text-white/40 mb-3">Network Status</p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
            Cross-chain pipeline
          </h2>
          <p className="text-sm text-white/40 max-w-lg mx-auto">
            Live connectivity to all three chains. Each plays a distinct role in the depeg defense pipeline.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {CHAINS.map((chain) => (
            <ChainCard key={chain.chainId} chain={chain} />
          ))}
        </div>

        {/* Data flow */}
        <div className="hidden md:flex items-center justify-center mt-8 gap-3">
          <span className="text-xs text-white/35 font-mono">Sync(r0, r1)</span>
          <div className="flex items-center gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-indigo-400/40 animate-pulse"
                style={{ animationDelay: `${i * 200}ms` }}
              />
            ))}
            <div className="w-8 h-px bg-gradient-to-r from-indigo-400/30 to-purple-400/30" />
          </div>
          <span className="text-xs text-white/35 font-mono">react()</span>
          <div className="flex items-center gap-1">
            <div className="w-8 h-px bg-gradient-to-r from-purple-400/30 to-blue-400/30" />
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-purple-400/40 animate-pulse"
                style={{ animationDelay: `${i * 200 + 600}ms` }}
              />
            ))}
          </div>
          <span className="text-xs text-white/35 font-mono">updateDepegState()</span>
        </div>
      </div>
    </section>
  );
}
