export const HOOK_ADDRESS = "0x8051EE84c86dBa66e72Bf51336e6059D41aa6080";
export const STABLECOIN = "0x2AFDE4A3Bca17E830c476c568014E595EA916a04";
export const CHAIN_ID = 1301;

export const HOOK_ABI = [
  "function setDepegState(address stablecoin, uint8 severity, uint256 driftBps) external",
  "function getDepegState(address stablecoin) view returns (uint8 severity, uint256 driftBps, uint256 updatedAt, bool isStale)",
  "function getCurrentFee(address stablecoin) view returns (uint24)",
  "function owner() view returns (address)",
  "event DepegStateUpdated(address indexed stablecoin, uint8 oldSeverity, uint8 newSeverity, uint256 priceDriftBps, uint256 timestamp)",
  "event FeeOverrideApplied(bytes32 indexed poolId, uint8 severity, uint24 fee)",
];

export type Severity = 0 | 1 | 2 | 3;

export interface SevConfig {
  label: string;
  tag: string;
  color: string;
  feeBps: number;
  feePct: string;
  barPct: number;
}

export const SEV: Record<Severity, SevConfig> = {
  0: { label: "NONE",     tag: "Peg Stable",  color: "#10b981", feeBps: 500,   feePct: "0.05%", barPct: 3 },
  1: { label: "MILD",     tag: "Minor Drift",  color: "#f59e0b", feeBps: 3000,  feePct: "0.30%", barPct: 20 },
  2: { label: "SEVERE",   tag: "High Risk",    color: "#f97316", feeBps: 10000, feePct: "1.00%", barPct: 50 },
  3: { label: "CRITICAL", tag: "Crisis Mode",  color: "#ef4444", feeBps: 50000, feePct: "5.00%", barPct: 100 },
};

export const SCENARIOS: { sev: Severity; drift: number; desc: string }[] = [
  { sev: 0, drift: 10,  desc: "Restore peg" },
  { sev: 1, drift: 100, desc: "1% drift" },
  { sev: 2, drift: 300, desc: "3% drift" },
  { sev: 3, drift: 700, desc: "7% drift" },
];
