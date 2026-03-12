# SentinelPeg — Demo Day Script

**Duration:** 3:30 – 3:45
**Audience:** Variant Fund, Dragonfly, USV, Uniswap Foundation judges
**Targets:** Reactive Network Prize, Unichain Prize, Uniswap Foundation Prize
**Tone:** Technical, confident, zero filler. Every sentence states a fact, shows a feature, or makes an argument.

---

## [0:00 – 0:40] THE HOOK — Problem Statement

**[SCREEN]** Black screen. Text fades in line by line:
```
March 11, 2023.
USDC drops to $0.87.
Stablecoin LPs lose $1.5 billion.
Every Uniswap pool kept charging the same 0.30% fee.
```

**VOICEOVER:**

"March 2023. Silicon Valley Bank collapses. USDC depegs to 87 cents. Over one and a half billion dollars in LP losses across stablecoin pools — in hours.

Here's what happened mechanically: the constant-product formula rebalanced every pool toward the depegging asset. Arbitrageurs drained the healthy side — ETH, DAI — at the same low fee the pool charged yesterday when USDC was at a dollar. The fee didn't move. It never moves.

**[SCREEN]** Slide: "The Gap"
```
Current stablecoin pools:
  ✗  Static fees — identical at $1.00 and $0.87
  ✗  No depeg awareness — local pool, no cross-chain data
  ✗  No autonomous response — manual withdrawal or centralized keepers

Zero decentralized, autonomous depeg defense exists in DeFi.
```

Today, Uniswap v4 gives us programmable hooks. But no hook has solved this. There is zero autonomous depeg defense in the ecosystem. That's the gap."

---

## [0:40 – 1:20] THE PITCH — Solution Overview

**[SCREEN]** Slide: SentinelPeg logo + one-liner
```
SentinelPeg
A Uniswap v4 hook that dynamically adjusts swap fees
based on real-time cross-chain depeg severity.

Built on Unichain. Powered by Reactive Network.
```

**VOICEOVER:**

"SentinelPeg is a Uniswap v4 dynamic fee hook. It monitors stablecoin prices cross-chain and adjusts swap fees in real time — autonomously, on every swap.

**[SCREEN]** Architecture diagram:
```
ETHEREUM                    REACTIVE NETWORK              UNICHAIN
┌─────────────────┐        ┌─────────────────┐        ┌──────────────────┐
│ Uniswap V2 Pool │──Sync──│ SentinelPeg     │──Call──│ SentinelPeg      │
│ USDC/WETH       │ events │ Reactive.sol    │  back  │ Hook.sol         │
│                 │        │                 │        │                  │
│ emits reserves  │        │ decode reserves │        │ updateDepegState │
│ on every trade  │        │ calculate drift │        │ beforeSwap()     │
│                 │        │ classify sev.   │        │ override fee     │
└─────────────────┘        └─────────────────┘        └──────────────────┘
```

Three contracts across three chains. On Ethereum, every trade in a stablecoin pool emits a Sync event. Our Reactive Smart Contract on Reactive Network subscribes to those events, decodes the reserves, calculates price drift, and classifies depeg severity. When severity changes, it fires a cross-chain callback to our hook on Unichain. The hook overrides the swap fee on every subsequent trade.

**[SCREEN]** Fee table appears:
```
Severity    Drift       Fee       What happens
────────────────────────────────────────────────
NONE        < 0.5%      0.05%     Competitive rate
MILD        0.5–2%      0.30%     LP compensation
SEVERE      2–5%        1.00%     Extraction deterrent
CRITICAL    > 5%        5.00%     Maximum protection
────────────────────────────────────────────────
STALE       no data     0.30%     Safe fallback
```

Four graduated tiers. We don't halt the pool — we make extraction progressively more expensive. At 5%, it costs a hundred times more to drain the pool than at normal operation. Fees return to normal automatically when the peg recovers."

---

## [1:20 – 2:30] THE DEMO — Live Proof It Works

### Tests [1:20 – 1:50]

**[ACTION]** Switch to terminal. Already in project root.
**[ACTION]** Run: `forge test`

**VOICEOVER:**

"Let me prove it works. Fifty-four tests. Three suites.

**[SCREEN]** Terminal showing tests running. Green PASS lines filling the screen.

Thirty-two unit tests for the hook — fee tiers at every severity, staleness after one hour, access control, event emission, and real swaps executing through the v4 PoolManager under every depeg condition. Thirteen tests for the reactive contract — severity classification, confirmation logic, callback encoding. Nine end-to-end tests simulating the complete pipeline: reactive event triggers state change, hook overrides fee, swap goes through with the correct fee applied.

**[SCREEN]** Final summary appears:
```
54 tests passed, 0 failed, 0 skipped
```

Fifty-four passed. Zero failed."

### Frontend Demo [1:50 – 2:30]

**[ACTION]** Switch to browser at `http://localhost:3000`

**VOICEOVER:**

"This is the SentinelPeg dashboard. It's connected to the deployed hook on Unichain Sepolia.

**[SCREEN]** Dashboard is visible. Hero section, "How It Works" section, then scroll to the live dashboard section.

**[ACTION]** Scroll to the dashboard section. Point at the severity card showing NONE, 0.00% drift, 0.05% fee.

The current state: severity NONE, zero drift, fee at 5 basis points. Normal operation.

**[ACTION]** Click the **MILD** simulation button.

**[SCREEN]** Severity card transitions — color shifts to amber, drift shows 1.00%, fee changes to 0.30%. Progress bar grows. Event log shows the action.

I trigger a mild depeg — 1% drift. Fee jumps to 30 basis points. LPs are being compensated for elevated risk.

**[ACTION]** Click **SEVERE**.

**[SCREEN]** Card shifts to orange. Fee shows 1.00%. Bar grows further.

Severe — 3% drift. One percent fee. Arbitrageurs now pay ten times the normal rate to swap against this pool.

**[ACTION]** Click **CRITICAL**.

**[SCREEN]** Card turns red. Fee shows 5.00%. Bar fills completely. Let it sit for 2 seconds.

Critical — 7% drift. Five percent fee. At this tier, draining the pool costs a hundred times what it costs at normal operation. In the March 2023 scenario, this single hook would have saved millions in LP losses.

**[ACTION]** Click **NONE**.

**[SCREEN]** Everything transitions back to green. Fee returns to 0.05%.

And recovery. Peg restored, fees drop to 5 basis points. The full cycle — detection, escalation, protection, recovery — with zero human intervention."

---

## [2:30 – 3:10] THE INTEGRATION — Reactive Network + Unichain

**[ACTION]** Switch to VS Code. Open `src/SentinelPegReactive.sol`.

### Reactive Network Deep Dive [2:30 – 2:50]

**[ACTION]** Scroll to constructor, highlight line ~148: `service.subscribe(originChainId, monitoredPool, SYNC_TOPIC_0, ...)`

**VOICEOVER:**

"This is our Reactive Smart Contract, deployed on Reactive Network. Line 148 — service.subscribe. We pass the origin chain ID, the pool address, and the Sync event topic. From deployment, every Sync event on that Ethereum pool is routed to this contract.

**[ACTION]** Scroll to `react()` function, line ~168. Highlight the function body.

The react function: decode reserves, compute implied price, calculate drift percentage, classify severity.

**[ACTION]** Highlight lines ~183-198, the confirmation logic.

Confirmation logic — two consecutive readings at the same severity before triggering a callback. Filters sandwich attacks and flash loan noise. Critical bypasses this — at 5% drift, you act immediately.

**[ACTION]** Highlight the `emit Callback(...)` line ~206.

The Callback event. Reactive Network picks this up and delivers it as an on-chain transaction to our hook on Unichain. This is not an oracle wrapper. This is a native Reactive Smart Contract with zero off-chain infrastructure. The monitoring is as decentralized as the chains it watches."

### Unichain Integration [2:50 – 3:10]

**[ACTION]** Switch to `src/SentinelPegHook.sol`. Scroll to `_beforeSwap()`, line ~137.

**VOICEOVER:**

"The hook, deployed on Unichain. beforeSwap resolves the fee on every single swap — looks up the stablecoin, checks staleness, returns the severity-based fee with OVERRIDE_FEE_FLAG so the PoolManager applies it.

**[ACTION]** Scroll to `updateDepegState()`, line ~169. Highlight the `onlyAuthorized` modifier.

updateDepegState — the callback receiver. Gated by onlyAuthorized, which checks the Reactive Network callback proxy address. Only the proxy or the owner can update depeg state.

**[ACTION]** Scroll to `_isStale()`, line ~257.

And staleness protection. If no callback arrives for one hour — Reactive Network goes down, gas runs out, anything — the hook falls back to a conservative 30 basis point fee. The system is safe even when the monitoring fails.

This is native Unichain infrastructure. Low-latency blocks mean fee adjustments hit within seconds of a callback. The PoolManager singleton means every stablecoin pool on Unichain can use this hook."

---

## [3:10 – 3:45] THE CLOSE — Impact Statement

**[SCREEN]** Final slide:
```
SentinelPeg

The first cross-chain depeg defense system for Uniswap v4.

3 chains                    Ethereum → Reactive Network → Unichain
4 severity tiers            0.05% → 0.30% → 1.00% → 5.00%
54 tests                    0 failures
Live deployment             Unichain Sepolia + Reactive Lasna

Deployed contracts:
  Hook:      0x8051EE84c86dBa66e72Bf51336e6059D41aa6080
  Reactive:  0x330eFe22a73AAD374b887d6F77cd90fa16b6cC60

Partners:   Reactive Network  ·  Unichain
Theme:      UHI8 — Specialized Markets
```

**VOICEOVER:**

"Stablecoin pools represent over two billion dollars in TVL on Uniswap. They are the highest-volume, most capital-efficient pools in the ecosystem — and they have zero autonomous depeg protection.

SentinelPeg is the first cross-chain aware hook in Uniswap v4. It uses Reactive Network for trustless event monitoring across chains and deploys as native stablecoin infrastructure on Unichain. It doesn't halt pools — it creates graduated economic disincentives that protect LPs while keeping markets functional.

The next stablecoin depeg is not a question of if. It's when. And when it happens, SentinelPeg makes sure the hook is already watching.

Thank you."

---

## Pre-Recording Checklist

**Setup (do this BEFORE hitting record):**
- [ ] Close all apps except: VS Code, Terminal, Chrome
- [ ] VS Code: dark theme, font size 16+, only two tabs open: `SentinelPegReactive.sol` and `SentinelPegHook.sol`
- [ ] Terminal: `cd` to project root, type `forge test` but don't hit enter yet
- [ ] Chrome: `http://localhost:3000` loaded, scrolled to top
- [ ] MetaMask: on Unichain Sepolia (chain 1301), has ETH for gas
- [ ] Slides: open in separate window (Google Slides, Keynote, or Canva)
- [ ] Desktop: clean, no notifications, no bookmarks bar in Chrome
- [ ] Resolution: 1920x1080

**Recording:**
- [ ] Tool: Loom (easiest) or OBS (more control)
- [ ] Record at 1080p minimum
- [ ] Use a real microphone if available — audio quality matters for VC judges
- [ ] Speak at a measured pace. Not fast, not slow. Confident.
- [ ] Do NOT say "um", "so basically", "kind of", "just", "actually"
- [ ] When showing code: pause for 1-2 seconds so judges can read the highlighted lines
- [ ] When showing the dashboard CRITICAL state: let it sit on screen for 2-3 seconds. The red fills the bar. Let it breathe.
- [ ] If you make a mistake, keep going. Do not restart unless it's a major stumble.

**Upload:**
- [ ] YouTube (unlisted) or Loom
- [ ] Test the link in an incognito window before submitting

**Submission:**
- [ ] Submission Type: **Uniswap Hook Incubator (UHI)**
- [ ] Partners: select **Reactive Network** AND **Unichain**
- [ ] Links section: demo video URL + `https://github.com/Sandijigs/SenitelPeg`
- [ ] Verify README has partner integration section with code line references
