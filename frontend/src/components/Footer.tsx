import { HOOK_ADDRESS } from "@/lib/constants";

const LINKS = [
  { label: "GitHub", href: "https://github.com/Sandijigs/SenitelPeg" },
  { label: "Hook on Blockscout", href: `https://unichain-sepolia.blockscout.com/address/${HOOK_ADDRESS}` },
  { label: "Reactive Network", href: "https://reactive.network" },
  { label: "Unichain", href: "https://unichain.org" },
];

export function Footer() {
  return (
    <footer className="border-t border-white/[0.03] py-12 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xs font-bold">
              S
            </div>
            <span className="text-xs font-semibold text-white/50">
              SentinelPeg
            </span>
          </div>

          {/* Links */}
          <div className="flex items-center gap-6">
            {LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-white/25 hover:text-white/60 transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>

        {/* Partners */}
        <div className="mt-8 pt-8 border-t border-white/[0.03] flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-[11px] text-white/15">
            Hookathon UHI8 &mdash; Specialized Markets
          </p>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              <span className="text-[11px] text-white/20">Uniswap v4</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
              <span className="text-[11px] text-white/20">Unichain</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
              <span className="text-[11px] text-white/20">Reactive Network</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
