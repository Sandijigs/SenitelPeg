# SentinelPeg

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
3. The **SentinelPeg hook** responds across three Uniswap v4 hook points:

   - **`beforeSwap`** — reads current severity and returns a dynamic fee override to the PoolManager
   - **`afterSwap`** — tracks cumulative swap volume during depeg events (protected volume metric)
   - **`beforeRemoveLiquidity`** — blocks LP withdrawals during CRITICAL depeg to prevent bank runs

| Severity | Price Drift | Fee | LP Withdrawals | Rationale |
|----------|-------------|-----|----------------|-----------|
| **NONE** | < 0.5% | 0.05% | Open | Normal operation — competitive fees |
| **MILD** | 0.5% – 2% | 0.30% | Open | Elevated risk — compensate LPs |
| **SEVERE** | 2% – 5% | 1.00% | Open | High risk — discourage pool draining |
| **CRITICAL** | > 5% | 5.00% | **Blocked** | Crisis mode — maximum LP protection |
| **STALE** | data too old | 0.30% | Open | Conservative fallback |

Fees automatically return to normal and LP withdrawals re-open as peg stability is restored.

---

## Architecture

> **V2 → V4 pipeline:** SentinelPeg monitors Uniswap **V2** pool reserves on Ethereum (the most widely available on-chain price signal) and uses that data to protect Uniswap **V4** pools on Unichain via dynamic fee hooks.

```
┌──────────────────────────────────────────────────────────┐
│              ETHEREUM SEPOLIA (Origin Chain)              │
│                                                          │
│    ┌──────────────────────┐                              │
│    │  Uniswap V2 Pool     │  emits Sync(reserve0,       │
│    │  Stablecoin / ETH    │        reserve1) events      │
│    └──────────┬───────────┘                              │
└───────────────┼──────────────────────────────────────────┘
                │  subscribed events
                ▼
┌──────────────────────────────────────────────────────────┐
│           REACTIVE NETWORK (Lasna Testnet)               │
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
│           UNICHAIN SEPOLIA (Destination Chain)           │
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
│    │                                          │          │
│    │  afterSwap():                            │          │
│    │    → tracks cumulative protected volume  │          │
│    │                                          │          │
│    │  beforeRemoveLiquidity():                │          │
│    │    → blocks LP withdrawals at CRITICAL   │          │
│    └──────────────────────────────────────────┘          │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## Deployed Contracts (Testnet)

| Contract | Network | Address |
|----------|---------|---------|
| SentinelPegHook | Unichain Sepolia | [`0x8051EE84c86dBa66e72Bf51336e6059D41aa6080`](https://unichain-sepolia.blockscout.com/address/0x8051EE84c86dBa66e72Bf51336e6059D41aa6080) |
| SentinelPegReactive | Reactive Lasna | [`0x330eFe22a73AAD374b887d6F77cd90fa16b6cC60`](https://lasna.reactscan.net/address/0x330eFe22a73AAD374b887d6F77cd90fa16b6cC60) |
| Callback Proxy | Unichain Sepolia | `0x9299472A6399Fd1027ebF067571Eb3e3D7837FC4` |
| spUSD (test stablecoin) | Unichain Sepolia | [`0x03540C0af2350218C206168e0F758450Db84e179`](https://unichain-sepolia.blockscout.com/address/0x03540C0af2350218C206168e0F758450Db84e179) |
| spETH (test token) | Unichain Sepolia | [`0x891Fc6d2dFEd0f5ff4Db00690eB552eB029564a8`](https://unichain-sepolia.blockscout.com/address/0x891Fc6d2dFEd0f5ff4Db00690eB552eB029564a8) |
| PoolSwapTest (router) | Unichain Sepolia | [`0xE626df117052511f5bF4E5299e317AFFfD5949Cd`](https://unichain-sepolia.blockscout.com/address/0xE626df117052511f5bF4E5299e317AFFfD5949Cd) |

---

## Partner Integrations

### Reactive Network

SentinelPeg uses Reactive Network as its core cross-chain monitoring and automation layer. The integration is **not theoretical** — `SentinelPegReactive.sol` is a fully functional Reactive Smart Contract deployed on the Lasna testnet that:

- **Subscribes** to `Sync(uint112,uint112)` events from a Uniswap V2 USDC/WETH pool on Ethereum Sepolia via the Reactive Network system contract (`service.subscribe()` in constructor, line 148–158 of `src/SentinelPegReactive.sol`)
- **Processes events** in the `react()` function (line 168–210), decoding pool reserves and calculating implied stablecoin price drift
- **Triggers cross-chain callbacks** by emitting the `Callback` event (line 206) with an encoded `updateDepegState()` payload that Reactive Network relays to the SentinelPeg hook on Unichain
- **Implements confirmation logic** (line 183–198) requiring 2 consecutive readings before changing severity to filter out noise, with an exception for CRITICAL severity which triggers immediately

Code references:
- `src/SentinelPegReactive.sol` — Reactive Smart Contract (full implementation)
- `src/SentinelPegHook.sol:169` — `updateDepegState()` callback receiver

### Unichain

SentinelPeg is designed and optimized as **Unichain-native stablecoin infrastructure**:

- Deployed on Unichain Sepolia (chain ID 1301) as the destination chain for Reactive Network callbacks
- Leverages Unichain's low-latency block production for responsive fee adjustments
- Built on Uniswap v4's PoolManager singleton architecture on Unichain

---

## Project Structure

```
sentinelpeg/
├── src/
│   ├── SentinelPegHook.sol           # Uniswap v4 hook — dynamic fees, volume tracking, LP guard
│   ├── SentinelPegReactive.sol       # Reactive Network — cross-chain monitor
│   └── interfaces/
│       └── ISentinelPeg.sol          # Shared types, events, errors
├── test/
│   ├── SentinelPegHook.t.sol         # Hook unit tests (42 tests)
│   ├── SentinelPegReactive.t.sol     # Reactive contract tests (13 tests)
│   └── SentinelPegE2E.t.sol          # End-to-end integration tests (11 tests)
├── script/
│   ├── DeployHook.s.sol              # Deploy hook to Unichain (CREATE2 + HookMiner)
│   ├── DeployReactive.s.sol          # Deploy reactive contract to Reactive Network
│   ├── DeployTestPool.s.sol          # Deploy test tokens + initialize Uniswap v4 pool
│   └── ConfigureHook.s.sol           # Post-deployment: register pool + set callback
├── frontend/                         # Next.js dashboard (React 19, Tailwind v4)
│   ├── src/
│   │   ├── app/                      # Next.js App Router pages
│   │   ├── components/               # Dashboard, swap UI, depeg controls, status cards
│   │   └── lib/                      # Contract ABI, types, wallet hook
│   ├── package.json
│   └── next.config.ts
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
- [Node.js](https://nodejs.org/) v18+ (for the frontend)
- Git

### Setup

```bash
git clone https://github.com/YOUR_USERNAME/sentinelpeg.git
cd sentinelpeg
chmod +x setup.sh
./setup.sh
```

This installs all Solidity dependencies (v4-core, v4-periphery, forge-std, OpenZeppelin, reactive-lib) and builds the project.

### Run Tests

```bash
# All 66 tests
forge test -vvv

# Only hook tests (42 tests)
forge test --match-contract SentinelPegHookTest -vvv

# Only reactive contract tests (13 tests)
forge test --match-contract SentinelPegReactiveTest -vvv

# End-to-end integration tests (11 tests)
forge test --match-contract SentinelPegE2ETest -vvv

# With gas reporting
forge test -vvv --gas-report
```

### Run Frontend

```bash
cd frontend
npm install
npm run dev
# Dashboard available at http://localhost:3000
```

The dashboard connects to the deployed hook on Unichain Sepolia via MetaMask. It supports:

- **Live on-chain state** — reads severity, fee, drift, LP lock status directly from the hook contract
- **Real token swaps** — execute swaps through the SentinelPeg hook via PoolSwapTest router
- **Depeg scenario testing** — trigger NONE / MILD / SEVERE / CRITICAL on-chain and see fees change in real-time
- **Test token minting** — mint spUSD and spETH (MockERC20) for testing
- **Activity log** — tracks all transactions with links to Blockscout

---

## Deployment

### Testnet Configuration

The project is configured for testnet deployment across three networks:

| Network | Chain ID | Role |
|---------|----------|------|
| Ethereum Sepolia | 11155111 | Origin chain — monitored USDC/ETH pool |
| Reactive Lasna | 5318007 | Cross-chain monitoring and callback relay |
| Unichain Sepolia | 1301 | Destination — hook deployed here |

> **Note:** Reactive Network requires all chains (origin + destination) to be either testnets or mainnets — mixing is not supported. Kopli testnet is deprecated; Lasna is the active testnet.

### Wallet Setup

1. **Add Unichain Sepolia** to MetaMask: RPC `https://sepolia.unichain.org`, Chain ID `1301`, Symbol `ETH`
2. **Add Reactive Lasna** to MetaMask: RPC `https://lasna-rpc.rnk.dev`, Chain ID `5318007`, Symbol `REACT`
3. Fund wallets:
   - Unichain Sepolia ETH: [Unichain Faucet](https://faucet.unichain.org/)
   - Reactive Lasna REACT: [Reactive Faucet](https://faucet.rnk.dev/)
   - Ethereum Sepolia ETH: [Sepolia Faucet](https://sepoliafaucet.com/)

### Step 1: Deploy Hook to Unichain Sepolia

The hook address must encode permission bits for `beforeInitialize`, `beforeSwap`, `afterSwap`, and `beforeRemoveLiquidity`. The deploy script uses `HookMiner` with CREATE2 to find a valid address.

```bash
source .env
forge script script/DeployHook.s.sol \
  --rpc-url $UNICHAIN_RPC_URL \
  --private-key $UNICHAIN_PRIVATE_KEY \
  --broadcast
```

Update `HOOK_ADDRESS` in `.env` with the deployed address.

### Step 2: Deploy Reactive Contract to Reactive Lasna

**Important:** Use `forge create` instead of `forge script` — the Reactive Network system contract (`0x0000000000000000000000000000000000fffFfF`) doesn't exist locally, so `forge script`'s local simulation fails. `forge create` sends the transaction directly.

```bash
source .env
forge create src/SentinelPegReactive.sol:SentinelPegReactive \
  --rpc-url $REACTIVE_RPC_URL \
  --private-key $REACTIVE_PRIVATE_KEY \
  --value 0.1ether \
  --constructor-args \
    $ETHEREUM_CHAIN_ID \
    $UNICHAIN_CHAIN_ID \
    $USDC_ETH_POOL \
    $HOOK_ADDRESS \
    $USDC_ADDRESS \
    $STABLECOIN_IS_TOKEN0 \
    $REFERENCE_ETH_PRICE
```

Update `REACTIVE_CONTRACT_ADDRESS` in `.env` with the deployed address.

### Step 3: Configure Hook

Set the Reactive Network callback proxy as the authorized caller:

```bash
source .env
cast send $HOOK_ADDRESS "setCallbackSource(address)" $REACTIVE_CALLBACK_PROXY \
  --rpc-url $UNICHAIN_RPC_URL \
  --private-key $UNICHAIN_PRIVATE_KEY
```

Optionally register a pool (if you've created a stablecoin pool on Unichain Sepolia):

```bash
forge script script/ConfigureHook.s.sol \
  --rpc-url $UNICHAIN_RPC_URL \
  --private-key $UNICHAIN_PRIVATE_KEY \
  --broadcast
```

### Block Explorers

- **Unichain Sepolia:** https://unichain-sepolia.blockscout.com
- **Reactive Lasna:** https://lasna.reactscan.net
- **Ethereum Sepolia:** https://sepolia.etherscan.io

---

## How It Works — Step by Step

1. **A trade happens** on the USDC/WETH pool on Ethereum Sepolia, emitting a `Sync` event
2. **Reactive Network detects** the event and routes it to `SentinelPegReactive.react()`
3. **The reactive contract calculates** the implied ETH price from reserves and computes the percentage drift from the expected peg
4. **Severity is classified** (NONE / MILD / SEVERE / CRITICAL) based on drift thresholds
5. **If severity changed** (with confirmation to filter noise), a `Callback` event is emitted
6. **Reactive Network relays** the callback as a transaction to `SentinelPegHook.updateDepegState()` on Unichain Sepolia
7. **The hook stores** the new severity, drift, and timestamp
8. **On every subsequent swap**, `beforeSwap()` reads the severity and returns the appropriate fee override to the PoolManager
9. **After each swap**, `afterSwap()` tracks cumulative swap volume during active depeg events (the "protected volume" metric)
10. **If a LP tries to withdraw** during CRITICAL severity, `beforeRemoveLiquidity()` reverts the transaction to prevent bank-run dynamics
11. **If the data becomes stale** (no update for >1 hour), the hook falls back to a conservative fee tier and LP withdrawals re-open

---

## Design Decisions

**Why Sync events instead of Chainlink oracles?**
Sync events are emitted on every trade in a Uniswap V2 pool — they're the most granular on-chain price signal available. Using them demonstrates deeper Reactive Network integration (cross-chain event subscription) rather than just reading an oracle.

**Why confirmation logic?**
A single Sync event with unusual reserves could be caused by a sandwich attack or flash loan. Requiring 2+ consecutive readings at the same severity filters out transient noise. CRITICAL severity is exempt — when there's a 5%+ depeg, you need to act immediately.

**Why staleness checks?**
If the Reactive Network callback stops arriving (network issue, gas exhaustion), the hook should not keep using outdated data. Stale data falls back to a conservative 0.30% fee — high enough to protect LPs, low enough not to kill the pool.

**Why `LPFeeLibrary.OVERRIDE_FEE_FLAG`?**
Uniswap v4's dynamic fee system requires hooks to explicitly signal that they're overriding the fee by OR-ing the flag with the fee value in the `beforeSwap` return. Without the flag, the PoolManager ignores the override.

**Why `_owner` constructor parameter?**
The hook is deployed via CREATE2 (required for address-encoded permission bits). With CREATE2, `msg.sender` in the constructor is the CREATE2 proxy, not the deployer wallet. Passing the owner explicitly ensures the correct address has admin control.

**Why LP withdrawal blocking at CRITICAL?**
During a severe depeg, LPs racing to exit create a bank-run dynamic that deepens the crisis and leaves slower participants with concentrated losses. By blocking `beforeRemoveLiquidity` at CRITICAL severity, the hook keeps liquidity in the pool — protecting both LPs and swappers. Withdrawals automatically re-open when severity drops or data becomes stale, so LPs are never permanently locked.

---

## Test Coverage

**66 tests across 3 test suites — all passing.**

| Suite | Tests | Description |
|-------|-------|-------------|
| `SentinelPegHookTest` | 42 | Hook deployment, fee tiers, staleness, access control, events, swap integration, volume tracking, LP withdrawal blocking, multi-stablecoin support, edge cases |
| `SentinelPegReactiveTest` | 13 | Constructor config, severity classification, confirmation logic, callback emission, edge cases |
| `SentinelPegE2ETest` | 11 | Full pipeline: reactive event → hook state → fee override → swap execution, LP withdrawal blocking under depeg |

---

## License

MIT
