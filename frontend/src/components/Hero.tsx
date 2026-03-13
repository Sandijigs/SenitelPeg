interface HeroProps {
  onConnect: () => void;
  isConnected: boolean;
  connecting: boolean;
}

export function Hero({ onConnect, isConnected, connecting }: HeroProps) {
  return (
    <section className="relative pt-32 pb-24 px-6 overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full opacity-[0.07] blur-[120px] bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 pointer-events-none" />

      <div className="relative max-w-3xl mx-auto text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-8 rounded-full border border-white/[0.06] text-sm text-white/50 bg-white/[0.02] animate-fade-in-up">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse-soft" />
          Hookathon UHI8 &mdash; Specialized Markets
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-[1.1] tracking-tight mb-6 animate-fade-in-up delay-100">
          Autonomous depeg defense
          <br />
          <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent animate-gradient">
            for stablecoin pools
          </span>
        </h1>

        <p className="text-base sm:text-lg text-white/40 leading-relaxed max-w-xl mx-auto mb-10 animate-fade-in-up delay-200">
          A Uniswap v4 hook that dynamically adjusts swap fees when stablecoins
          lose their peg — powered by real-time cross-chain monitoring via Reactive Network.
        </p>

        <div className="flex items-center justify-center gap-4 animate-fade-in-up delay-300">
          {isConnected ? (
            <a
              href="#dashboard"
              className="px-6 py-3 rounded-xl bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors"
            >
              Open Dashboard
            </a>
          ) : (
            <button
              onClick={onConnect}
              disabled={connecting}
              className="px-6 py-3 rounded-xl bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors disabled:opacity-50"
            >
              {connecting ? "Connecting..." : "Connect Wallet"}
            </button>
          )}
          <a
            href="https://github.com/Sandijigs/SentinelPeg"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 rounded-xl border border-white/[0.08] text-sm text-white/60 hover:text-white/90 hover:border-white/20 transition-all"
          >
            View Source
          </a>
        </div>
      </div>
    </section>
  );
}
