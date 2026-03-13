export const HOOK_ADDRESS = "0x8051EE84c86dBa66e72Bf51336e6059D41aa6080";
export const REACTIVE_ADDRESS = "0x330eFe22a73AAD374b887d6F77cd90fa16b6cC60";
export const CALLBACK_PROXY = "0x9299472A6399Fd1027ebF067571Eb3e3D7837FC4";
export const CHAIN_ID = 1301;

// Pool tokens deployed on Unichain Sepolia
export const TOKEN0 = "0x03540C0af2350218C206168e0F758450Db84e179"; // spUSD (stablecoin)
export const TOKEN1 = "0x891Fc6d2dFEd0f5ff4Db00690eB552eB029564a8"; // spETH
export const STABLECOIN = TOKEN0; // hook tracks depeg state by this address

// Routers
export const SWAP_ROUTER = "0xE626df117052511f5bF4E5299e317AFFfD5949Cd";
export const LIQUIDITY_ROUTER = "0xA2A08202d7407Eb952A82edce7d92093D044f3fB";

export const EXPLORER_URL = "https://unichain-sepolia.blockscout.com";
export const REACTIVE_EXPLORER = "https://lasna.reactscan.net";

// PoolKey for the deployed pool
export const POOL_KEY = {
  currency0: TOKEN0,
  currency1: TOKEN1,
  fee: 0x800000, // DYNAMIC_FEE_FLAG
  tickSpacing: 60,
  hooks: HOOK_ADDRESS,
};

// Price limits for swaps
export const MIN_SQRT_PRICE_LIMIT = "4295128740"; // MIN_SQRT_PRICE + 1
export const MAX_SQRT_PRICE_LIMIT = "1461446703485210103287273052203988822378723970341"; // MAX_SQRT_PRICE - 1

export const HOOK_ABI = [
  // State-changing (owner only)
  "function setDepegState(address stablecoin, uint8 severity, uint256 driftBps) external",
  // Views — depeg state
  "function getDepegState(address stablecoin) view returns (uint8 severity, uint256 driftBps, uint256 updatedAt, bool isStale)",
  "function getCurrentFee(address stablecoin) view returns (uint24)",
  "function isLiquidityLocked(address stablecoin) view returns (bool)",
  "function totalProtectedVolume() view returns (uint256)",
  // Views — contract config
  "function owner() view returns (address)",
  "function callbackSource() view returns (address)",
  "function stalenessThreshold() view returns (uint256)",
  "function FEE_NONE() view returns (uint24)",
  "function FEE_MILD() view returns (uint24)",
  "function FEE_SEVERE() view returns (uint24)",
  "function FEE_CRITICAL() view returns (uint24)",
  "function FEE_STALE() view returns (uint24)",
  "function DEFAULT_STALENESS() view returns (uint256)",
  // Events
  "event DepegStateUpdated(address indexed stablecoin, uint8 oldSeverity, uint8 newSeverity, uint256 priceDriftBps, uint256 timestamp)",
  "event FeeOverrideApplied(bytes32 indexed poolId, uint8 severity, uint24 fee)",
  "event SwapTracked(bytes32 indexed poolId, uint8 severity, uint256 absVolume, uint256 cumulativeVolume)",
  "event LiquidityRemovalBlocked(bytes32 indexed poolId, address indexed sender, uint8 severity)",
];

export const ERC20_ABI = [
  "function mint(address to, uint256 amount) external",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
];

export const SWAP_ROUTER_ABI = [
  "function swap(tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, tuple(bool zeroForOne, int256 amountSpecified, uint160 sqrtPriceLimitX96) params, tuple(bool takeClaims, bool settleUsingBurn) testSettings, bytes hookData) external payable returns (int256)",
];

export type Severity = 0 | 1 | 2 | 3;

export interface SevConfig {
  label: string;
  tag: string;
  color: string;
}

export const SEV: Record<Severity, SevConfig> = {
  0: { label: "NONE",     tag: "Peg Stable",  color: "#10b981" },
  1: { label: "MILD",     tag: "Minor Drift",  color: "#f59e0b" },
  2: { label: "SEVERE",   tag: "High Risk",    color: "#f97316" },
  3: { label: "CRITICAL", tag: "Crisis Mode",  color: "#ef4444" },
};

export const DEPEG_SCENARIOS: { sev: Severity; drift: number; label: string; desc: string }[] = [
  { sev: 0, drift: 10,  label: "Restore Peg",  desc: "Clear depeg — normal fees" },
  { sev: 1, drift: 100, label: "Mild Depeg",    desc: "1% drift — elevated fees" },
  { sev: 2, drift: 300, label: "Severe Depeg",  desc: "3% drift — high fees" },
  { sev: 3, drift: 700, label: "Critical Depeg", desc: "7% drift — max fees + LP lock" },
];
