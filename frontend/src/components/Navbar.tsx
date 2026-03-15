"use client";

import { HOOK_ADDRESS, EXPLORER_URL } from "@/lib/constants";

interface NavbarProps {
  address: string | null;
  connecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function Navbar({ address, connecting, onConnect, onDisconnect }: NavbarProps) {
  const isConnected = !!address;
  const shortAddr = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : null;

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.04]"
      style={{ background: "rgba(6,8,15,0.85)", backdropFilter: "blur(16px)" }}
    >
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

        {/* Nav links — only when connected */}
        {isConnected && (
          <div className="hidden md:flex items-center gap-8 animate-fade-in">
            <a href="#dashboard" className="text-sm text-white/50 hover:text-white/90 transition-colors">
              Dashboard
            </a>
            <a href="#chain-status" className="text-sm text-white/50 hover:text-white/90 transition-colors">
              Networks
            </a>
            <a href="#tech-specs" className="text-sm text-white/50 hover:text-white/90 transition-colors">
              Specs
            </a>
            <a
              href={`${EXPLORER_URL}/address/${HOOK_ADDRESS}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-white/50 hover:text-white/90 transition-colors flex items-center gap-1.5"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse-soft" />
              Contract
            </a>
          </div>
        )}

        {/* Wallet button */}
        {isConnected ? (
          <div className="flex items-center gap-3">
            <span className="text-sm text-emerald-400 border border-emerald-500/20 px-4 py-2 rounded-lg">
              {shortAddr}
            </span>
            <button
              onClick={onDisconnect}
              className="text-sm font-medium px-4 py-2 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-all duration-200"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <button
            onClick={onConnect}
            disabled={connecting}
            className="text-sm font-medium px-5 py-2.5 rounded-lg bg-white text-black hover:bg-white/90 transition-all duration-200 disabled:opacity-50"
          >
            {connecting ? "Connecting..." : "Connect Wallet"}
          </button>
        )}
      </div>
    </nav>
  );
}
