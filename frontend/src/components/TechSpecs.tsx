import type { ContractConfig } from "@/lib/types";

function formatFee(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

interface TechSpecsProps {
  config?: ContractConfig | null;
}

export function TechSpecs({ config }: TechSpecsProps) {
  const staleness = config ? `${config.stalenessThreshold}s` : "loading...";
  const staleFee = config ? formatFee(config.feeStale) : "...";
  const feeRange = config
    ? `${formatFee(config.feeNone)} → ${formatFee(config.feeCritical)}`
    : "loading...";

  const SPECS = [
    {
      title: "Confirmation Logic",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
        </svg>
      ),
      color: "#10b981",
      details: [
        { label: "Mechanism", value: "2 consecutive readings required" },
        { label: "Exception", value: "CRITICAL bypasses — fires immediately" },
        { label: "Purpose", value: "Filters sandwich attacks & flash loan noise" },
        { label: "Reset", value: "Counter resets if severity fluctuates" },
      ],
    },
    {
      title: "Staleness Protection",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: "#f59e0b",
      details: [
        { label: "Threshold", value: staleness },
        { label: "Fallback Fee", value: staleFee },
        { label: "Trigger", value: "No callback within threshold" },
        { label: "Recovery", value: "Automatic on next valid callback" },
      ],
    },
    {
      title: "Fee Override",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
        </svg>
      ),
      color: "#3b82f6",
      details: [
        { label: "Method", value: "LPFeeLibrary.OVERRIDE_FEE_FLAG" },
        { label: "Hook", value: "beforeSwap() on every trade" },
        { label: "Scope", value: "Per-stablecoin, per-swap resolution" },
        { label: "Range", value: feeRange },
      ],
    },
    {
      title: "Liquidity Guard",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
      ),
      color: "#ef4444",
      details: [
        { label: "Hook", value: "beforeRemoveLiquidity()" },
        { label: "Trigger", value: "CRITICAL severity" },
        { label: "Action", value: "Reverts LP withdrawal transactions" },
        { label: "Recovery", value: "Unlocks when severity drops or data stales" },
      ],
    },
    {
      title: "Volume Tracking",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
      ),
      color: "#06b6d4",
      details: [
        { label: "Hook", value: "afterSwap() on every trade" },
        { label: "Tracking", value: "Cumulative volume during depeg" },
        { label: "Scope", value: "Per-pool and total across all pools" },
        { label: "Purpose", value: "Quantifies LP value protected" },
      ],
    },
    {
      title: "Access Control",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
      ),
      color: "#8b5cf6",
      details: [
        { label: "Modifier", value: "onlyAuthorized" },
        { label: "Allowed", value: "Reactive callback proxy + owner" },
        { label: "Registration", value: "Owner-gated pool registration" },
        { label: "Upgradeable", value: "Callback source updatable by owner" },
      ],
    },
  ];

  return (
    <section id="tech-specs" className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-xs uppercase tracking-[0.2em] text-white/40 mb-3">Under the Hood</p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
            Technical specifications
          </h2>
          <p className="text-base text-white/40 max-w-lg mx-auto">
            Values read from the deployed contract. No hardcoded data.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          {SPECS.map((spec) => (
            <div
              key={spec.title}
              className="rounded-2xl border border-white/[0.04] p-7 hover:border-white/[0.08] transition-all duration-300"
              style={{ background: "var(--bg-card)" }}
            >
              {/* Header */}
              <div className="flex items-center gap-4 mb-6">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{
                    backgroundColor: `${spec.color}12`,
                    border: `1px solid ${spec.color}25`,
                    color: spec.color,
                  }}
                >
                  {spec.icon}
                </div>
                <h3 className="text-lg font-semibold">{spec.title}</h3>
              </div>

              {/* Details */}
              <div className="space-y-3">
                {spec.details.map((detail) => (
                  <div
                    key={detail.label}
                    className="flex items-start justify-between gap-4 py-2.5 border-b border-white/[0.03] last:border-0"
                  >
                    <span className="text-xs text-white/40 uppercase tracking-wider shrink-0 pt-0.5">
                      {detail.label}
                    </span>
                    <span className="text-sm text-white/60 text-right font-mono leading-relaxed">
                      {detail.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
