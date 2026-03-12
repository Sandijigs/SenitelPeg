export interface LogEntry {
  id: string;
  time: string;
  message: string;
}

export interface DepegState {
  severity: number;
  driftBps: number;
  isStale: boolean;
}

export interface WalletState {
  address: string | null;
  isConnected: boolean;
}
