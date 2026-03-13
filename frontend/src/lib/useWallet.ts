"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { BrowserProvider, Contract, Eip1193Provider, parseUnits, formatUnits } from "ethers";
import {
  HOOK_ADDRESS, HOOK_ABI, STABLECOIN, CHAIN_ID, EXPLORER_URL,
  TOKEN0, TOKEN1, SWAP_ROUTER, ERC20_ABI, SWAP_ROUTER_ABI,
  POOL_KEY, MIN_SQRT_PRICE_LIMIT, MAX_SQRT_PRICE_LIMIT,
} from "./constants";
import type { Severity } from "./constants";
import type { DepegState, ContractConfig, OnChainEvent, TokenBalances } from "./types";

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      isMetaMask?: boolean;
      on?: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
    };
  }
}

const SEV_LABELS = ["NONE", "MILD", "SEVERE", "CRITICAL"] as const;

export function useWallet(addLog: (msg: string) => void) {
  const [address, setAddress] = useState<string | null>(null);
  const [contract, setContract] = useState<Contract | null>(null);
  const [config, setConfig] = useState<ContractConfig | null>(null);
  const [liveDepeg, setLiveDepeg] = useState<DepegState | null>(null);
  const [recentEvents, setRecentEvents] = useState<OnChainEvent[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [balances, setBalances] = useState<TokenBalances | null>(null);
  const [swapping, setSwapping] = useState(false);
  const [minting, setMinting] = useState(false);
  const signerRef = useRef<Awaited<ReturnType<BrowserProvider["getSigner"]>> | null>(null);
  const prevBalancesRef = useRef<TokenBalances | null>(null);
  const listenerCleanup = useRef<(() => void) | null>(null);
  const contractRef = useRef<Contract | null>(null);

  /** Read contract configuration */
  const readConfig = useCallback(async (c: Contract): Promise<ContractConfig | null> => {
    try {
      const [owner, callbackSource, stalenessThreshold, feeNone, feeMild, feeSevere, feeCritical, feeStale] =
        await Promise.all([
          c.owner(),
          c.callbackSource(),
          c.stalenessThreshold(),
          c.FEE_NONE(),
          c.FEE_MILD(),
          c.FEE_SEVERE(),
          c.FEE_CRITICAL(),
          c.FEE_STALE(),
        ]);
      return {
        owner: owner as string,
        callbackSource: callbackSource as string,
        stalenessThreshold: Number(stalenessThreshold),
        feeNone: Number(feeNone),
        feeMild: Number(feeMild),
        feeSevere: Number(feeSevere),
        feeCritical: Number(feeCritical),
        feeStale: Number(feeStale),
      };
    } catch {
      return null;
    }
  }, []);

  /** Read live depeg state */
  const readHookState = useCallback(
    async (c: Contract): Promise<DepegState | null> => {
      try {
        // Read core state — this should always work
        const [sev, drift, updatedAt, stale] = await c.getDepegState(STABLECOIN);

        // Read secondary values individually so one failure doesn't break everything
        let fee = 0;
        let totalVol = "0";

        try { fee = Number(await c.getCurrentFee(STABLECOIN)); } catch { /* default 0 */ }
        try { totalVol = (await c.totalProtectedVolume()).toString(); } catch { /* default "0" */ }

        // Derive locked state from severity + staleness (same logic as contract)
        // CRITICAL (3) + not stale = liquidity locked
        const severity = Number(sev);
        const isStale = Boolean(stale);
        const locked = severity === 3 && !isStale;

        return {
          severity,
          driftBps: Number(drift),
          updatedAt: Number(updatedAt),
          isStale,
          currentFeeBps: fee,
          liquidityLocked: locked,
          totalProtectedVolume: totalVol,
        };
      } catch {
        // Even getDepegState failed — return a safe default so UI still renders
        return {
          severity: 0,
          driftBps: 0,
          updatedAt: 0,
          isStale: false,
          currentFeeBps: 0,
          liquidityLocked: false,
          totalProtectedVolume: "0",
        };
      }
    },
    [],
  );

  /** Read recent DepegStateUpdated events from chain history */
  const readRecentEvents = useCallback(async (c: Contract) => {
    try {
      const filter = c.filters.DepegStateUpdated(STABLECOIN);
      // Query last ~5000 blocks for events
      const currentBlock = await c.runner?.provider?.getBlockNumber();
      if (!currentBlock) return;
      const fromBlock = Math.max(0, currentBlock - 5000);
      const logs = await c.queryFilter(filter, fromBlock, currentBlock);

      const events: OnChainEvent[] = logs.slice(-20).map((log) => {
        const parsed = c.interface.parseLog({ topics: log.topics as string[], data: log.data });
        return {
          id: `${log.transactionHash}-${log.index}`,
          event: "DepegStateUpdated",
          blockNumber: log.blockNumber,
          txHash: log.transactionHash,
          args: {
            oldSeverity: Number(parsed?.args[1] ?? 0),
            newSeverity: Number(parsed?.args[2] ?? 0),
            driftBps: Number(parsed?.args[3] ?? 0),
          },
        };
      });

      setRecentEvents(events);
      if (events.length > 0) {
        addLog(`Loaded ${events.length} historical DepegStateUpdated events`);
      }
    } catch {
      // Event query not supported on all RPCs — non-critical
    }
  }, [addLog]);

  /** Ensure wallet is on Unichain Sepolia */
  const ensureNetwork = useCallback(async (): Promise<BrowserProvider | null> => {
    if (!window.ethereum) return null;

    const provider = new BrowserProvider(window.ethereum as unknown as Eip1193Provider);
    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);

    if (chainId === CHAIN_ID) return provider;

    addLog(`Wrong network (chain ${chainId}). Switching to Unichain Sepolia...`);
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${CHAIN_ID.toString(16)}` }],
      });
    } catch (switchErr: unknown) {
      if ((switchErr as { code?: number })?.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: `0x${CHAIN_ID.toString(16)}`,
            chainName: "Unichain Sepolia",
            nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
            rpcUrls: ["https://sepolia.unichain.org"],
            blockExplorerUrls: [EXPLORER_URL],
          }],
        });
      } else {
        addLog("Failed to switch network");
        return null;
      }
    }
    return new BrowserProvider(window.ethereum as unknown as Eip1193Provider);
  }, [addLog]);

  /** Subscribe to live events */
  const subscribeToEvents = useCallback(
    (c: Contract) => {
      listenerCleanup.current?.();

      const filter = c.filters.DepegStateUpdated(STABLECOIN);

      const handler = async (
        _stablecoin: string,
        oldSev: bigint,
        newSev: bigint,
        driftBps: bigint,
        _timestamp: bigint,
      ) => {
        addLog(`On-chain event: ${SEV_LABELS[Number(oldSev)]} → ${SEV_LABELS[Number(newSev)]} (drift: ${(Number(driftBps) / 100).toFixed(1)}%)`);
        const state = await readHookState(c);
        if (state) setLiveDepeg(state);
      };

      c.on(filter, handler);
      listenerCleanup.current = () => {
        c.off(filter, handler);
      };
    },
    [addLog, readHookState],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => { listenerCleanup.current?.(); };
  }, []);

  /** Read token balances */
  const readBalances = useCallback(async (logChange = false) => {
    if (!signerRef.current) return;
    try {
      const signer = signerRef.current;
      const addr = await signer.getAddress();
      const provider = signer.provider;
      if (!provider) return;
      const t0 = new Contract(TOKEN0, ERC20_ABI, provider);
      const t1 = new Contract(TOKEN1, ERC20_ABI, provider);
      const [bal0, bal1, sym0, sym1, dec0, dec1] = await Promise.all([
        t0.balanceOf(addr), t1.balanceOf(addr),
        t0.symbol(), t1.symbol(),
        t0.decimals(), t1.decimals(),
      ]);
      const newBal0 = formatUnits(bal0, Number(dec0));
      const newBal1 = formatUnits(bal1, Number(dec1));

      if (logChange && prevBalancesRef.current) {
        const prev = prevBalancesRef.current;
        const diff0 = Number(newBal0) - Number(prev.token0);
        const diff1 = Number(newBal1) - Number(prev.token1);
        if (Math.abs(diff0) > 0.001 || Math.abs(diff1) > 0.001) {
          addLog(`Balance change: ${sym0} ${diff0 >= 0 ? "+" : ""}${diff0.toFixed(2)}, ${sym1} ${diff1 >= 0 ? "+" : ""}${diff1.toFixed(2)}`);
        }
      }

      const newBalances = {
        token0: newBal0,
        token1: newBal1,
        token0Symbol: sym0 as string,
        token1Symbol: sym1 as string,
      };
      prevBalancesRef.current = newBalances;
      setBalances(newBalances);
    } catch {
      // Non-critical — balances will show as null
    }
  }, [addLog]);

  /** Mint test tokens (MockERC20 has public mint) */
  const mintTestTokens = useCallback(async () => {
    if (!signerRef.current) {
      addLog("Not connected");
      return;
    }
    setMinting(true);
    try {
      const signer = signerRef.current;
      const addr = await signer.getAddress();
      const t0 = new Contract(TOKEN0, ERC20_ABI, signer);
      const t1 = new Contract(TOKEN1, ERC20_ABI, signer);
      const amount = parseUnits("1000", 18);

      addLog("Minting 1000 spUSD...");
      const tx0 = await t0.mint(addr, amount);
      addLog(`spUSD mint tx: ${EXPLORER_URL}/tx/${tx0.hash}`);
      await tx0.wait();
      addLog("spUSD minted. Now minting 1000 spETH...");

      const tx1 = await t1.mint(addr, amount);
      addLog(`spETH mint tx: ${EXPLORER_URL}/tx/${tx1.hash}`);
      await tx1.wait();
      addLog("Both tokens minted successfully");
      await readBalances();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("user rejected")) {
        addLog("Mint rejected by user");
      } else {
        addLog(`Mint failed: ${msg.slice(0, 100)}`);
      }
    } finally {
      setMinting(false);
    }
  }, [addLog, readBalances]);

  /** Execute a swap through the hook. Returns true on success. */
  const executeSwap = useCallback(async (zeroForOne: boolean, amountStr: string): Promise<boolean> => {
    if (!signerRef.current) {
      addLog("Not connected");
      return false;
    }
    setSwapping(true);
    try {
      const signer = signerRef.current;
      const amount = parseUnits(amountStr, 18);
      const tokenIn = zeroForOne ? TOKEN0 : TOKEN1;
      const b = prevBalancesRef.current;
      const tokenLabel = zeroForOne
        ? `${b?.token0Symbol ?? "token0"} → ${b?.token1Symbol ?? "token1"}`
        : `${b?.token1Symbol ?? "token1"} → ${b?.token0Symbol ?? "token0"}`;
      const sqrtPriceLimit = zeroForOne ? MIN_SQRT_PRICE_LIMIT : MAX_SQRT_PRICE_LIMIT;

      // Approve swap router
      const tokenContract = new Contract(tokenIn, ERC20_ABI, signer);
      const addr = await signer.getAddress();
      const allowance = await tokenContract.allowance(addr, SWAP_ROUTER);
      if (BigInt(allowance) < BigInt(amount)) {
        addLog("Approving swap router...");
        const approveTx = await tokenContract.approve(SWAP_ROUTER, amount);
        await approveTx.wait();
      }

      addLog(`Swapping ${amountStr} ${tokenLabel}...`);

      const router = new Contract(SWAP_ROUTER, SWAP_ROUTER_ABI, signer);
      const key = [
        POOL_KEY.currency0,
        POOL_KEY.currency1,
        POOL_KEY.fee,
        POOL_KEY.tickSpacing,
        POOL_KEY.hooks,
      ];
      // amountSpecified negative = exact input
      const params = [zeroForOne, -BigInt(amount), sqrtPriceLimit];
      const testSettings = [false, false]; // takeClaims=false, settleUsingBurn=false
      const hookData = "0x";

      const tx = await router.swap(key, params, testSettings, hookData);
      addLog(`Swap tx: ${EXPLORER_URL}/tx/${tx.hash}`);
      const receipt = await tx.wait();

      if (receipt?.status === 0) {
        addLog("Swap transaction reverted on-chain");
        return false;
      }

      addLog("Swap confirmed! The hook applied its dynamic fee based on current depeg severity.");

      // Wait a moment for RPC to index the new state, then refresh
      await new Promise((r) => setTimeout(r, 2000));
      await readBalances(true);
      const c = contractRef.current;
      if (c) {
        const state = await readHookState(c);
        if (state) setLiveDepeg(state);
      }
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("user rejected")) {
        addLog("Swap rejected by user");
      } else if (msg.includes("0x7c9c6e8f") || msg.includes("PriceLimitAlreadyExceeded")) {
        // Pool price has been pushed to the boundary of the liquidity range
        const direction = zeroForOne ? "opposite" : "opposite";
        const b = prevBalancesRef.current;
        const suggestion = zeroForOne
          ? `${b?.token1Symbol ?? "token1"} → ${b?.token0Symbol ?? "token0"}`
          : `${b?.token0Symbol ?? "token0"} → ${b?.token1Symbol ?? "token1"}`;
        addLog(`Pool price limit reached — no liquidity in this direction. Try swapping ${suggestion} instead, or use a smaller amount.`);
      } else {
        addLog(`Swap failed: ${msg.slice(0, 120)}`);
      }
      return false;
    } finally {
      setSwapping(false);
    }
  }, [addLog, readBalances, readHookState]);

  /** Connect wallet */
  const connect = useCallback(async (): Promise<void> => {
    if (typeof window === "undefined" || !window.ethereum) {
      alert("Please install MetaMask or another Web3 wallet to continue.");
      return;
    }

    setConnecting(true);
    try {
      await window.ethereum.request({ method: "eth_requestAccounts" });

      const provider = await ensureNetwork();
      if (!provider) { setConnecting(false); return; }

      const s = await provider.getSigner();
      const addr = await s.getAddress();
      signerRef.current = s;
      const hookContract = new Contract(HOOK_ADDRESS, HOOK_ABI, s);
      contractRef.current = hookContract;

      setAddress(addr);
      setContract(hookContract);
      addLog(`Wallet connected: ${addr.slice(0, 6)}...${addr.slice(-4)}`);
      addLog(`Network: Unichain Sepolia (${CHAIN_ID})`);

      // Read config, state, and recent events in parallel
      const [cfg, state] = await Promise.all([
        readConfig(hookContract),
        readHookState(hookContract),
      ]);

      if (cfg) {
        setConfig(cfg);
        setIsOwner(addr.toLowerCase() === cfg.owner.toLowerCase());
        addLog(`Hook owner: ${cfg.owner.slice(0, 6)}...${cfg.owner.slice(-4)}${addr.toLowerCase() === cfg.owner.toLowerCase() ? " (you)" : ""}`);
        addLog(`Callback source: ${cfg.callbackSource === "0x0000000000000000000000000000000000000000" ? "not configured" : `${cfg.callbackSource.slice(0, 6)}...${cfg.callbackSource.slice(-4)}`}`);
      }

      if (state) {
        setLiveDepeg(state);
        addLog(`Current state: ${SEV_LABELS[state.severity]} | fee: ${(state.currentFeeBps / 100).toFixed(2)}% | drift: ${(state.driftBps / 100).toFixed(1)}%`);
        if (state.isStale) addLog("Data STALE — fallback fee active");
        if (state.liquidityLocked) addLog("LP withdrawals BLOCKED (CRITICAL)");
      } else {
        addLog("Failed to read contract state — verify deployment");
      }

      // Read balances and historical events (non-blocking)
      readBalances();
      readRecentEvents(hookContract);

      // Subscribe to live events
      subscribeToEvents(hookContract);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("user rejected")) {
        addLog("Connection rejected by user");
      } else {
        addLog(`Connection failed: ${msg}`);
      }
    } finally {
      setConnecting(false);
    }
  }, [addLog, ensureNetwork, readConfig, readHookState, readRecentEvents, readBalances, subscribeToEvents]);

  /** Trigger on-chain state change (owner only — demonstrates Reactive callback) */
  const triggerStateChange = useCallback(
    async (severity: Severity, driftBps: number): Promise<DepegState | null> => {
      const c = contractRef.current;
      if (!c) {
        addLog("Not connected");
        return null;
      }

      try {
        addLog(`Triggering state change → ${SEV_LABELS[severity]}, drift=${(driftBps / 100).toFixed(1)}%`);
        addLog("Sending setDepegState() transaction...");
        const tx = await c.setDepegState(STABLECOIN, severity, driftBps);
        addLog(`Tx submitted: ${EXPLORER_URL}/tx/${tx.hash}`);
        await tx.wait();
        addLog("Transaction confirmed");

        // Read verified on-chain state
        const state = await readHookState(c);
        if (state) {
          setLiveDepeg(state);

          // Log what each hook would do now
          addLog(`→ beforeSwap: fee override = ${(state.currentFeeBps / 100).toFixed(2)}%`);
          if (state.severity > 0) {
            addLog(`→ afterSwap: volume tracking ACTIVE`);
          } else {
            addLog(`→ afterSwap: volume tracking idle`);
          }
          if (state.liquidityLocked) {
            addLog(`→ beforeRemoveLiquidity: BLOCKING withdrawals`);
          } else {
            addLog(`→ beforeRemoveLiquidity: withdrawals allowed`);
          }
        }
        return state;
      } catch (err: unknown) {
        const reason = (err as { reason?: string })?.reason;
        const message = err instanceof Error ? err.message : String(err);
        if (reason === "NotOwner()" || message.includes("NotOwner")) {
          addLog("Transaction reverted: only the contract owner can call setDepegState()");
        } else if (message.includes("user rejected")) {
          addLog("Transaction rejected by user");
        } else {
          addLog(`Transaction failed: ${reason || message}`);
        }
        return null;
      }
    },
    [addLog, readHookState],
  );

  /** Refresh state from chain */
  const refreshState = useCallback(async () => {
    const c = contractRef.current;
    if (!c) return;
    const state = await readHookState(c);
    if (state) {
      setLiveDepeg(state);
      addLog("State refreshed from chain");
    }
  }, [readHookState, addLog]);

  return {
    address,
    isConnected: !!address,
    isOwner,
    connecting,
    config,
    liveDepeg,
    recentEvents,
    balances,
    swapping,
    minting,
    connect,
    triggerStateChange,
    refreshState,
    mintTestTokens,
    executeSwap,
  };
}
