"use client";

import { useState, useCallback } from "react";
import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { HowItWorks } from "@/components/HowItWorks";
import { Dashboard } from "@/components/Dashboard";
import { Footer } from "@/components/Footer";
import { useWallet } from "@/lib/useWallet";
import type { LogEntry } from "@/lib/types";

export default function Page() {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const addLog = useCallback((message: string) => {
    const time = new Date().toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    setLogs((prev) => [{ id: crypto.randomUUID(), time, message }, ...prev]);
  }, []);

  const wallet = useWallet(addLog);

  const handleConnect = useCallback(async () => {
    await wallet.connect();
    document.getElementById("dashboard")?.scrollIntoView({ behavior: "smooth" });
  }, [wallet.connect]);

  return (
    <>
      <Navbar
        address={wallet.address}
        connecting={wallet.connecting}
        onConnect={handleConnect}
      />
      <Hero onConnect={handleConnect} isConnected={wallet.isConnected} connecting={wallet.connecting} />
      <HowItWorks />

      <div className={wallet.isConnected ? "animate-fade-in" : "hidden"}>
        <Dashboard
          isOwner={wallet.isOwner}
          config={wallet.config}
          depeg={wallet.liveDepeg}
          logs={logs}
          balances={wallet.balances}
          swapping={wallet.swapping}
          minting={wallet.minting}
          triggerStateChange={wallet.triggerStateChange}
          refreshState={wallet.refreshState}
          mintTestTokens={wallet.mintTestTokens}
          executeSwap={wallet.executeSwap}
        />
      </div>

      {!wallet.isConnected && (
        <section className="py-20 px-6">
          <div className="max-w-md mx-auto text-center">
            <h3 className="text-xl font-semibold mb-2">Ready to explore?</h3>
            <p className="text-sm text-white/40 mb-6">
              Connect your wallet to see live hook state and trigger depeg scenarios on Unichain Sepolia.
            </p>
            <button
              onClick={handleConnect}
              disabled={wallet.connecting}
              className="px-6 py-3 rounded-xl bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors disabled:opacity-50"
            >
              {wallet.connecting ? "Connecting..." : "Connect Wallet"}
            </button>
          </div>
        </section>
      )}

      <Footer />
    </>
  );
}
