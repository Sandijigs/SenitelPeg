# 🛡️ SentinelPeg

**Real-time depeg defense for stablecoin liquidity pools on Uniswap v4.**

SentinelPeg is a Uniswap v4 hook that protects stablecoin LPs from depeg events by dynamically adjusting swap fees based on cross-chain price monitoring powered by [Reactive Network](https://reactive.network/).

> **Hookathon Submission** — UHI8 "Specialized Markets" theme

---

## The Problem

Stablecoin liquidity providers face catastrophic losses during depeg events. When USDC drifted from its peg in March 2023, LPs in stablecoin pools absorbed millions in impermanent loss before anyone could react. Current defenses are either:

- **Manual** — LPs must monitor prices and withdraw liquidity themselves (too slow)
- **Centralized keepers** — Off-chain bots that introduce trust assumptions
- **Non-existent** — Most pools have no depeg protection at all

There is no decentralized, cross-chain, autonomous depeg defense system for Uniswap v4 stablecoin pools today.

## The Solution

SentinelPeg combines **Uniswap v4 dynamic fee hooks** with **Reactive Network's cross-chain event monitoring** to create an autonomous depeg defense system:

1. A **Reactive Smart Contract** on Reactive Network continuously monitors stablecoin pool reserves on Ethereum (or other origin chains)
2. When price deviation is detected, the reactive contract classifies severity and sends a **cross-chain callback** to the hook on Unichain
3. The **SentinelPeg hook** adjusts swap fees in real-time via `beforeSwap`, protecting LPs with graduated fee tiers:

| Severity | Price Drift | Fee | Rationale |
|----------|-------------|-----|-----------|
| **NONE** | < 0.5% | 0.05% | Normal operation — competitive fees |
| **MILD** | 0.5% – 2% | 0.30% | Elevated risk — compensate LPs |
| **SEVERE** | 2% – 5% | 1.00% | High risk — discourage pool draining |
| **CRITICAL** | > 5% | 5.00% | Crisis mode — maximum LP protection |
| **STALE** | data too old | 0.30% | Conservative fallback |

Fees automatically return to normal as peg stability is restored.

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                  ETHEREUM (Origin Chain)                  │
│                                                          │
│    ┌──────────────────────┐                              │
│    │  Uniswap V2 Pool     │  emits Sync(reserve0,       │
│    │  USDC / WETH          │        reserve1) events     │
│    └──────────┬───────────┘                              │
└───────────────┼──────────────────────────────────────────┘
                │  subscribed events
                ▼
┌──────────────────────────────────────────────────────────┐
│               REACTIVE NETWORK                           │
│                                                          │
│    ┌──────────────────────────────────────────┐          │
│    │  SentinelPegReactive.sol                 │          │
│    │                                          │          │
│    │  react():                                │          │
│    │    1. Decode reserves                    │          │
│    │    2. Calculate price drift              │          │
│    │    3. Classify severity                  │          │
│    │    4. Emit Callback if changed           │          │
│    └──────────┬───────────────────────────────┘          │
└───────────────┼──────────────────────────────────────────┘
                │  cross-chain callback
                ▼
┌──────────────────────────────────────────────────────────┐
│               UNICHAIN (Destination Chain)               │
│                                                          │
│    ┌──────────────────────────────────────────┐          │
│    │  SentinelPegHook.sol  (Uniswap v4 Hook)  │          │
│    │                                          │          │
│    │  updateDepegState():                     │          │
│    │    ← receives callback from Reactive     │          │
│    │    ← stores severity + drift + timestamp │          │
│    │                                          │          │
│    │  beforeSwap():                           │          │
│    │    → reads current severity              │          │
│    │    → checks staleness                    │          │
│    │    → returns fee override to PoolManager │          │
│    └──────────────────────────────────────────┘          │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## Partner Integrations

### Reactive Network

SentinelPeg uses Reactive Network as its core cross-chain monitoring and automation layer. The integration is **not theoretical** — `SentinelPegReactive.sol` is a fully functional Reactive Smart Contract that:

- **Subscribes** to `Sync(uint112,uint112)` events from a Uniswap V2 USDC/WETH pool on Ethereum via the Reactive Network system contract (`service.subscribe()` in constructor, line 148–158 of `src/SentinelPegReactive.sol`)
- **Processes events** in the `react()` function (line 168–210), decoding pool reserves and calculating implied stablecoin price drift
- **Triggers cross-chain callbacks** by emitting the `Callback` event (line 206) with an encoded `updateDepegState()` payload that Reactive Network relays to the SentinelPeg hook on Unichain
- **Implements confirmation logic** (line 183–198) requiring 2 consecutive readings before changing severity to filter out noise, with an exception for CRITICAL severity which triggers immediately

Code references:
- `src/SentinelPegReactive.sol` — Reactive Smart Contract (full implementation)
- `src/SentinelPegHook.sol:updateDepegState()` — Callback receiver (line 130–140)

### Unichain

SentinelPeg is designed and optimized as **Unichain-native stablecoin infrastructure**:

- Deployed on Unichain (chain ID 130) as the destination chain for Reactive Network callbacks
- Leverages Unichain's low-latency block production for responsive fee adjustments
- Built on Uniswap v4's PoolManager singleton architecture on Unichain

---

## Project Structure

```
sentinelpeg/
├── src/
│   ├── SentinelPegHook.sol           # Uniswap v4 hook — dynamic fee logic
│   ├── SentinelPegReactive.sol       # Reactive Network — cross-chain monitor
│   └── interfaces/
│       └── ISentinelPeg.sol          # Shared types, events, errors
├── test/
│   ├── SentinelPegHook.t.sol         # Hook test suite (27 tests)
│   └── SentinelPegReactive.t.sol     # Reactive contract test suite (14 tests)
├── script/
│   ├── DeployHook.s.sol              # Deploy hook to Unichain
│   └── DeployReactive.s.sol          # Deploy reactive contract to Reactive Network
├── frontend/
│   └── index.html                    # Demo dashboard
├── foundry.toml
├── remappings.txt
├── setup.sh                          # One-command project setup
├── .env.example
└── README.md
```

---

## Getting Started

### Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation) (forge, cast, anvil)
- Git

### Setup

```bash
git clone https://github.com/YOUR_USERNAME/sentinelpeg.git
cd sentinelpeg
chmod +x setup.sh
./setup.sh
```

This installs all dependencies (v4-core, v4-periphery, forge-std, OpenZeppelin, reactive-lib) and builds the project.

### Run Tests

```bash
# All tests
forge test -vvv

# Only hook tests
forge test --match-contract SentinelPegHookTest -vvv

# Only reactive contract tests
forge test --match-contract SentinelPegReactiveTest -vvv

# With gas reporting
forge test -vvv --gas-report
```

### Expected Test Output

```
Running 27 tests for test/SentinelPegHook.t.sol:SentinelPegHookTest
[PASS] test_ownerIsDeployer()
[PASS] test_defaultStaleness()
[PASS] test_revertIfPoolNotDynamic()
[PASS] test_feeNone()
[PASS] test_feeMild()
[PASS] test_feeSevere()
[PASS] test_feeCritical()
[PASS] test_neverSetIsNotStale()
[PASS] test_freshUpdateIsNotStale()
[PASS] test_oldUpdateIsStale()
[PASS] test_staleFeeUsedDuringSwap()
[PASS] test_recoveryFromCriticalToNone()
[PASS] test_gradualRecovery()
[PASS] test_onlyOwnerCanSetState()
[PASS] test_onlyOwnerCanRegisterPool()
[PASS] test_unauthorizedCallbackReverts()
[PASS] test_callbackSourceCanUpdate()
[PASS] test_ownerCanAlsoCallUpdate()
[PASS] test_setStalenessThreshold()
[PASS] test_setStalenessThresholdTooLow()
[PASS] test_zeroAddressReverts()
[PASS] test_registerPoolZeroAddressReverts()
[PASS] test_emitsDepegStateUpdated()
[PASS] test_emitsCallbackSourceUpdated()
[PASS] test_emitsPoolRegistered()
[PASS] test_swapSucceedsUnderNone()
[PASS] test_swapSucceedsUnderMild()
[PASS] test_swapSucceedsUnderCritical()
[PASS] test_swapUnregisteredPoolUsesDefaultFee()
[PASS] test_independentStablecoinStates()
[PASS] test_multipleRapidStateChanges()
[PASS] test_stalenessResetAfterNewUpdate()

Running 14 tests for test/SentinelPegReactive.t.sol:SentinelPegReactiveTest
[PASS] test_constructorSetsConfig()
[PASS] test_initialSeverityIsNone()
[PASS] test_noDrift()
[PASS] test_mildDepeg()
[PASS] test_severeDepeg()
[PASS] test_criticalDepeg()
[PASS] test_negativeDrift()
[PASS] test_confirmationResetsOnFluctuate()
[PASS] test_noRedundantCallbacks()
[PASS] test_recoveryFromCriticalToNone()
[PASS] test_zeroReservesReturnZeroDrift()
[PASS] test_revertOnWrongTopic()
[PASS] test_callbackEmittedOnSeverityChange()
```

---

## Deployment

### 1. Deploy Hook to Unichain

```bash
# Fill in .env first
source .env

# Update POOL_MANAGER address in script/DeployHook.s.sol
forge script script/DeployHook.s.sol \
  --rpc-url $UNICHAIN_RPC_URL \
  --private-key $UNICHAIN_PRIVATE_KEY \
  --broadcast
```

> **Note:** The hook address must encode permission bits for `beforeInitialize` and `beforeSwap`. Use `HookMiner` from v4-periphery to find a valid salt for CREATE2 deployment.

### 2. Configure Hook

```bash
# Register pool and set callback source
cast send $HOOK_ADDRESS "registerPool((address,address,uint24,int24,address),address)" \
  "($CURRENCY0,$CURRENCY1,$FEE,$TICK_SPACING,$HOOK_ADDRESS)" $USDC_ADDRESS \
  --rpc-url $UNICHAIN_RPC_URL --private-key $UNICHAIN_PRIVATE_KEY

cast send $HOOK_ADDRESS "setCallbackSource(address)" $REACTIVE_CALLBACK_PROXY \
  --rpc-url $UNICHAIN_RPC_URL --private-key $UNICHAIN_PRIVATE_KEY
```

### 3. Deploy Reactive Contract

```bash
# Update HOOK_ADDRESS in script/DeployReactive.s.sol
forge script script/DeployReactive.s.sol \
  --rpc-url $REACTIVE_RPC_URL \
  --private-key $REACTIVE_PRIVATE_KEY \
  --broadcast --value 0.01ether
```

---

## How It Works — Step by Step

1. **A trade happens** on the USDC/WETH pool on Ethereum, emitting a `Sync` event
2. **Reactive Network detects** the event and routes it to `SentinelPegReactive.react()`
3. **The reactive contract calculates** the implied ETH price from reserves and computes the percentage drift from the expected peg
4. **Severity is classified** (NONE → MILD → SEVERE → CRITICAL) based on drift thresholds
5. **If severity changed** (with confirmation to filter noise), a `Callback` event is emitted
6. **Reactive Network relays** the callback as a transaction to `SentinelPegHook.updateDepegState()` on Unichain
7. **The hook stores** the new severity, drift, and timestamp
8. **On every subsequent swap**, `beforeSwap()` reads the severity and returns the appropriate fee override to the PoolManager
9. **If the data becomes stale** (no update for >1 hour), the hook falls back to a conservative fee tier

---

## Design Decisions

**Why Sync events instead of Chainlink oracles?**
Sync events are emitted on every trade in a Uniswap V2 pool — they're the most granular on-chain price signal available. Using them demonstrates deeper Reactive Network integration (cross-chain event subscription) rather than just reading an oracle.

**Why confirmation logic?**
A single Sync event with unusual reserves could be caused by a sandwich attack or flash loan. Requiring 2+ consecutive readings at the same severity filters out transient noise. CRITICAL severity is exempt — when there's a 5%+ depeg, you need to act immediately.

**Why staleness checks?**
If the Reactive Network callback stops arriving (network issue, gas exhaustion), the hook should not keep using outdated data. Stale data falls back to a conservative 0.30% fee — high enough to protect LPs, low enough not to kill the pool.

**Why `LPFeeLibrary.OVERRIDE_FEE_FLAG`?**
Uniswap v4's dynamic fee system requires hooks to explicitly signal that they're overriding the fee by OR-ing the flag with the fee value in the `beforeSwap` return. This is not optional — without the flag, the PoolManager ignores the override.

---

## License

MIT
