"use client";

import { HOOK_ADDRESS } from "@/lib/constants";

interface NavbarProps {
  address: string | null;
  onConnect: () => void;
}

export function Navbar({ address, onConnect }: NavbarProps) {
  const shortHook = `${HOOK_ADDRESS.slice(0, 6)}...${HOOK_ADDRESS.slice(-4)}`;
  const shortWallet = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : null;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.04]" style={{ background: "rgba(6,8,15,0.8)", backdropFilter: "blur(16px)" }}>
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-sm font-bold">
            S
          </div>
          <span className="text-sm font-semibold tracking-tight">
            Sentinel<span className="text-blue-400">Peg</span>
          </span>
        </div>

        {/* Center - navigation */}
        <div className="hidden md:flex items-center gap-8">
          <a href="#how-it-works" className="text-xs text-white/40 hover:text-white/80 transition-colors">How It Works</a>
          <a href="#dashboard" className="text-xs text-white/40 hover:text-white/80 transition-colors">Dashboard</a>
          <a
            href={`https://unichain-sepolia.blockscout.com/address/${HOOK_ADDRESS}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-white/40 hover:text-white/80 transition-colors flex items-center gap-1.5"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse-soft" />
            {shortHook}
          </a>
        </div>

        {/* Wallet */}
        <button
          onClick={onConnect}
          className={`text-xs font-medium px-4 py-2 rounded-lg transition-all duration-200 ${
            address
              ? "border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/5"
              : "bg-white text-black hover:bg-white/90"
          }`}
        >
          {shortWallet ? `${shortWallet}` : "Connect Wallet"}
        </button>
      </div>
    </nav>
  );
}
