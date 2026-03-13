import { HOOK_ADDRESS, EXPLORER_URL } from "@/lib/constants";

export function Footer() {
  return (
    <footer className="border-t border-white/[0.03] py-10 px-6">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-[10px] font-bold">
            S
          </div>
          <span className="text-sm text-white/40">SentinelPeg</span>
          <span className="text-xs text-white/20">&mdash; Hookathon UHI8</span>
        </div>

        <div className="flex items-center gap-5">
          <a href="https://github.com/Sandijigs/SentinelPeg" target="_blank" rel="noopener noreferrer"
            className="text-sm text-white/30 hover:text-white/60 transition-colors">
            GitHub
          </a>
          <a href={`${EXPLORER_URL}/address/${HOOK_ADDRESS}`} target="_blank" rel="noopener noreferrer"
            className="text-sm text-white/30 hover:text-white/60 transition-colors">
            Contract
          </a>
          <a href="https://reactive.network" target="_blank" rel="noopener noreferrer"
            className="text-sm text-white/30 hover:text-white/60 transition-colors">
            Reactive Network
          </a>
        </div>
      </div>
    </footer>
  );
}
