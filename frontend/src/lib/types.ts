export interface LogEntry {
  id: string;
  time: string;
  message: string;
}

export interface DepegState {
  severity: number;
  driftBps: number;
  updatedAt: number;
  isStale: boolean;
  currentFeeBps: number;
  liquidityLocked: boolean;
  totalProtectedVolume: string;
}

export interface ContractConfig {
  owner: string;
  callbackSource: string;
  stalenessThreshold: number;
  feeNone: number;
  feeMild: number;
  feeSevere: number;
  feeCritical: number;
  feeStale: number;
}

export interface OnChainEvent {
  id: string;
  event: string;
  blockNumber: number;
  txHash: string;
  args: Record<string, string | number>;
}

export interface TokenBalances {
  token0: string; // formatted balance string
  token1: string;
  token0Symbol: string;
  token1Symbol: string;
}
