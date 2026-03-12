"use client";

import { useState, useCallback } from "react";
import { BrowserProvider, JsonRpcSigner, Contract } from "ethers";
import { HOOK_ADDRESS, HOOK_ABI, STABLECOIN } from "./constants";
import type { Severity } from "./constants";
import type { DepegState } from "./types";

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      isMetaMask?: boolean;
    };
  }
}

export function useWallet(addLog: (msg: string) => void) {
  const [address, setAddress] = useState<string | null>(null);
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null);
  const [contract, setContract] = useState<Contract | null>(null);

  const connect = useCallback(async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      alert("Please install MetaMask to connect your wallet.");
      return;
    }

    try {
      const provider = new BrowserProvider(window.ethereum);
      const s = await provider.getSigner();
      const addr = await s.getAddress();

      const hookContract = new Contract(HOOK_ADDRESS, HOOK_ABI, s);

      setAddress(addr);
      setSigner(s);
      setContract(hookContract);
      addLog(`Wallet connected: ${addr}`);

      // Try reading on-chain state
      try {
        const [sev, drift, , stale] = await hookContract.getDepegState(STABLECOIN);
        if (stale) addLog("Depeg data is STALE — using conservative fees");
        return {
          severity: Number(sev),
          driftBps: Number(drift),
          isStale: Boolean(stale),
        } as DepegState;
      } catch {
        addLog("Could not read on-chain state (expected in demo mode)");
      }
    } catch (err) {
      addLog(`Connection failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    return null;
  }, [addLog]);

  const simulateOnChain = useCallback(
    async (severity: Severity, driftBps: number) => {
      if (!contract) return;

      try {
        addLog("Sending tx to setDepegState...");
        const tx = await contract.setDepegState(STABLECOIN, severity, driftBps);
        addLog(`Tx hash: ${tx.hash}`);
        await tx.wait();
        addLog("State updated on-chain");
      } catch (err: unknown) {
        const reason = (err as { reason?: string })?.reason;
        const message = err instanceof Error ? err.message : String(err);
        addLog(`Tx failed: ${reason || message}`);
      }
    },
    [contract, addLog],
  );

  return {
    address,
    isConnected: !!address,
    signer,
    contract,
    connect,
    simulateOnChain,
  };
}
