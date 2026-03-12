export const HOOK_ADDRESS = "0x8051EE84c86dBa66e72Bf51336e6059D41aa6080";
export const STABLECOIN = "0x2AFDE4A3Bca17E830c476c568014E595EA916a04";
export const CHAIN_ID = 1301; // Unichain Sepolia

export const HOOK_ABI = [
  "function setDepegState(address stablecoin, uint8 severity, uint256 driftBps) external",
  "function getDepegState(address stablecoin) view returns (uint8 severity, uint256 driftBps, uint256 updatedAt, bool isStale)",
  "function getCurrentFee(address stablecoin) view returns (uint24)",
  "function owner() view returns (address)",
  "event DepegStateUpdated(address indexed stablecoin, uint8 oldSeverity, uint8 newSeverity, uint256 priceDriftBps, uint256 timestamp)",
  "event FeeOverrideApplied(bytes32 indexed poolId, uint8 severity, uint24 fee)",
];

export const SEV_LABELS = ["NONE", "MILD", "SEVERE", "CRITICAL"] as const;

export type Severity = 0 | 1 | 2 | 3;

export const SEV_CONFIG: Record<
  Severity,
  { label: string; color: string; bg: string; feeBps: number; feePct: string; barWidth: string; barColor: string; btnClass: string }
> = {
  0: {
    label: "NONE",
    color: "text-green-400",
    bg: "bg-green-950",
    feeBps: 500,
    feePct: "0.05%",
    barWidth: "1%",
    barColor: "bg-green-500",
    btnClass: "bg-green-500 text-black hover:bg-green-400",
  },
  1: {
    label: "MILD",
    color: "text-yellow-400",
    bg: "bg-yellow-950",
    feeBps: 3000,
    feePct: "0.30%",
    barWidth: "15%",
    barColor: "bg-yellow-500",
    btnClass: "bg-yellow-500 text-black hover:bg-yellow-400",
  },
  2: {
    label: "SEVERE",
    color: "text-orange-400",
    bg: "bg-orange-950",
    feeBps: 10000,
    feePct: "1.00%",
    barWidth: "40%",
    barColor: "bg-orange-500",
    btnClass: "bg-orange-500 text-black hover:bg-orange-400",
  },
  3: {
    label: "CRITICAL",
    color: "text-red-400",
    bg: "bg-red-950",
    feeBps: 50000,
    feePct: "5.00%",
    barWidth: "100%",
    barColor: "bg-red-500",
    btnClass: "bg-red-500 text-white hover:bg-red-400",
  },
};

export const SIMULATION_SCENARIOS: { severity: Severity; driftBps: number; emoji: string }[] = [
  { severity: 0, driftBps: 10, emoji: "check-mark" },
  { severity: 1, driftBps: 100, emoji: "warning" },
  { severity: 2, driftBps: 300, emoji: "large-orange-diamond" },
  { severity: 3, driftBps: 700, emoji: "red-circle" },
];
