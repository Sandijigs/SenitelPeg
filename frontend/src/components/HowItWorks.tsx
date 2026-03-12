import { SEV, type Severity } from "@/lib/constants";

const STEPS = [
  {
    num: "01",
    title: "Monitor",
    chain: "Ethereum",
    desc: "Reactive Smart Contract subscribes to Sync events from Uniswap V2 stablecoin pools, capturing every reserve update on-chain.",
    accent: "#6366f1",
  },
  {
    num: "02",
    title: "Classify",
    chain: "Reactive Network",
    desc: "Price drift is calculated from reserves and classified into severity tiers. Requires 2 consecutive readings to confirm (except CRITICAL).",
    accent: "#8b5cf6",
  },
  {
    num: "03",
    title: "Protect",
    chain: "Unichain",
    desc: "Cross-chain callback updates the v4 hook. Every swap now pays a fee proportional to depeg risk, protecting LPs automatically.",
    accent: "#3b82f6",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-16">
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/25 mb-3">How it works</p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Three chains. One defense system.
          </h2>
        </div>

        {/* Steps */}
        <div className="grid md:grid-cols-3 gap-6 mb-20">
          {STEPS.map((step) => (
            <div
              key={step.num}
              className="group relative rounded-2xl border border-white/[0.04] p-8 hover:border-white/[0.08] transition-all duration-300"
              style={{ background: "var(--bg-card)" }}
            >
              {/* Step number */}
              <span className="text-5xl font-bold" style={{ color: `${step.accent}15` }}>
                {step.num}
              </span>
              <div className="mt-4">
                <div className="flex items-center gap-3 mb-3">
                  <h3 className="text-lg font-semibold">{step.title}</h3>
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                    style={{
                      color: step.accent,
                      backgroundColor: `${step.accent}10`,
                      border: `1px solid ${step.accent}20`,
                    }}
                  >
                    {step.chain}
                  </span>
                </div>
                <p className="text-sm text-white/35 leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Fee schedule */}
        <div className="rounded-2xl border border-white/[0.04] overflow-hidden" style={{ background: "var(--bg-card)" }}>
          <div className="px-8 py-6 border-b border-white/[0.04]">
            <h3 className="text-sm font-semibold">Fee Schedule</h3>
            <p className="text-xs text-white/30 mt-1">Dynamic fees scale with depeg severity</p>
          </div>
          <div className="divide-y divide-white/[0.03]">
            {([0, 1, 2, 3] as Severity[]).map((sev) => {
              const c = SEV[sev];
              return (
                <div key={sev} className="px-8 py-5 flex items-center gap-6">
                  {/* Color dot + label */}
                  <div className="flex items-center gap-3 w-32 shrink-0">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                    <span className="text-sm font-medium" style={{ color: c.color }}>{c.label}</span>
                  </div>
                  {/* Tag */}
                  <span className="text-xs text-white/25 w-24 shrink-0">{c.tag}</span>
                  {/* Bar */}
                  <div className="flex-1 h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${c.barPct}%`, backgroundColor: c.color }}
                    />
                  </div>
                  {/* Fee */}
                  <span className="text-sm font-mono font-medium w-16 text-right" style={{ color: c.color }}>
                    {c.feePct}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
