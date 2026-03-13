const STEPS = [
  {
    num: "1",
    title: "Detect",
    desc: "We monitor stablecoin prices on Ethereum in real time. If the price drifts from its peg, we catch it instantly.",
    accent: "#6366f1",
  },
  {
    num: "2",
    title: "Classify",
    desc: "The drift is classified as Mild, Severe, or Critical based on how far the price has moved. Two consecutive readings are required to confirm.",
    accent: "#8b5cf6",
  },
  {
    num: "3",
    title: "Protect",
    desc: "Swap fees on Unichain adjust automatically — higher fees during depeg protect liquidity providers. At critical levels, LP withdrawals are blocked entirely.",
    accent: "#3b82f6",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 px-6">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            How it works
          </h2>
        </div>

        <div className="space-y-6">
          {STEPS.map((step) => (
            <div
              key={step.num}
              className="flex gap-5 items-start"
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 mt-0.5"
                style={{
                  backgroundColor: `${step.accent}12`,
                  border: `1px solid ${step.accent}25`,
                  color: step.accent,
                }}
              >
                {step.num}
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-1">{step.title}</h3>
                <p className="text-sm text-white/45 leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
