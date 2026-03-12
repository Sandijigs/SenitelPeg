# SentinelPeg — Demo Video Script

**Target: 4:30 – 5:00 minutes**
**Tone: Confident, clear, energetic. You built something real — show it.**

---

## PART 1: Hook the Viewer (0:00 – 1:40)

### Slide 1 — Open with the stakes (0:00 – 0:30)

> **Screen:** Black screen, then reveal:
> "March 2023. USDC drops to $0.87."
> "Stablecoin LPs on Uniswap lost millions in hours."
> "Nobody's hook stopped it."

**Say:**
"In March 2023, USDC depegged to 87 cents. Stablecoin LPs on Uniswap were left completely exposed — millions in losses in hours. Some pulled liquidity manually, most didn't react in time, and no automated system existed to protect them. Today, if the same thing happened on a Uniswap v4 pool — the result would be identical. There is no on-chain, cross-chain, autonomous depeg defense for Uniswap v4. Until now."

---

### Slide 2 — Introduce SentinelPeg (0:30 – 0:50)

> **Screen:**
> **SentinelPeg**
> _Autonomous depeg defense for stablecoin pools on Uniswap v4_
>
> Built on: **Unichain** + **Reactive Network**
> Hookathon UHI8 — "Specialized Markets"

**Say:**
"This is SentinelPeg. It's a Uniswap v4 dynamic fee hook deployed on Unichain that uses Reactive Network for real-time cross-chain price monitoring. When a stablecoin starts losing its peg on Ethereum, SentinelPeg detects it and automatically raises swap fees on Unichain to protect liquidity providers — no keepers, no bots, no human in the loop."

---

### Slide 3 — How it works: The three-chain pipeline (0:50 – 1:20)

> **Screen:** Architecture diagram with 3 chains highlighted:
>
> ```
> ETHEREUM ──── Sync events ────> REACTIVE NETWORK ──── callback ────> UNICHAIN
>  (V2 pool)                      (classify severity)                   (V4 hook)
> ```
>
> Below the diagram, show the fee table:
> | Severity | Drift | Fee |
> |----------|-------|-----|
> | NONE | < 0.5% | 0.05% |
> | MILD | 0.5–2% | 0.30% |
> | SEVERE | 2–5% | 1.00% |
> | CRITICAL | > 5% | 5.00% |

**Say:**
"Here's the full pipeline — it spans three chains. On Ethereum, every trade in a Uniswap V2 stablecoin pool emits a Sync event with the latest reserves. Our Reactive Smart Contract, deployed on Reactive Network's Lasna testnet, subscribes to those events. It decodes the reserves, calculates price drift from the expected peg, and classifies it into four severity levels. When severity changes, it fires a cross-chain callback directly to our Uniswap v4 hook on Unichain. The hook then overrides the swap fee in beforeSwap — from a competitive 5 basis points under normal conditions, all the way up to 500 basis points during a crisis. And when the peg recovers, fees drop back automatically."

---

### Slide 4 — Why these partners matter (1:20 – 1:40)

> **Screen:**
>
> **Why Unichain?**
> - Native home for Uniswap v4 hooks
> - Low-latency blocks = fast fee response
> - PoolManager singleton = efficient hook execution
> - This is stablecoin infrastructure built where it belongs
>
> **Why Reactive Network?**
> - Trustless cross-chain event subscriptions (no oracles, no keepers)
> - subscribe() in constructor = automatic monitoring from deploy
> - Callbacks execute as on-chain transactions on the destination chain
> - The monitoring is as decentralized as the chains it watches

**Say:**
"Why these two partners? Unichain is the natural home for Uniswap v4 hooks — low-latency blocks mean our fee adjustments hit fast, and the PoolManager singleton makes hook execution efficient. SentinelPeg is stablecoin infrastructure built where it belongs. And Reactive Network is what makes the cross-chain piece trustless. Our reactive contract subscribes to events on Ethereum directly through the Reactive Network system contract — no oracles, no keeper bots, no off-chain relayers. The callback that updates our hook arrives as a real on-chain transaction on Unichain. Both integrations are deployed and wired together on testnet right now."

---

## PART 2: Show the Code (1:40 – 3:00)

### The Reactive Smart Contract (1:40 – 2:10)

**Action:** Open `src/SentinelPegReactive.sol` in VS Code.

**Scroll to and highlight these sections:**
1. Line ~148: `service.subscribe(originChainId, monitoredPool, SYNC_TOPIC, ...)` in constructor
2. Line ~168: `react()` function — the event processing pipeline
3. Line ~183: Confirmation logic — `confirmCount >= 2` before changing state
4. Line ~237: `_classifySeverity()` — drift thresholds

**Say:**
"Let me show you the code. This is SentinelPegReactive — our Reactive Smart Contract deployed on Reactive Network Lasna. In the constructor, we call service.subscribe on the Reactive Network system contract, passing the origin chain ID, the pool address, and the Sync event topic. From that moment, every Sync event on that Ethereum pool gets routed to our react function. React decodes the reserves, calculates the implied stablecoin price, computes the drift percentage, and classifies severity. One key design decision — we require two consecutive readings at the same severity before triggering a callback. This filters out noise from sandwich attacks and flash loans. But CRITICAL severity fires immediately — when you're 5% off peg, you can't afford to wait for confirmation."

---

### The Uniswap v4 Hook on Unichain (2:10 – 2:40)

**Action:** Open `src/SentinelPegHook.sol` in VS Code.

**Scroll to and highlight these sections:**
1. Line ~104: `getHookPermissions()` — beforeInitialize + beforeSwap
2. Line ~126: `_beforeInitialize()` — enforces DYNAMIC_FEE_FLAG
3. Line ~137: `_beforeSwap()` — resolves fee, emits event, returns override with OVERRIDE_FEE_FLAG
4. Line ~169: `updateDepegState()` — callback receiver, gated by onlyAuthorized
5. Line ~257: `_isStale()` — staleness fallback

**Say:**
"And this is the hook, deployed on Unichain Sepolia. It uses two hook permissions: beforeInitialize to enforce that pools must use dynamic fees, and beforeSwap where the real work happens. On every swap, _beforeSwap looks up which stablecoin the pool tracks, checks if the depeg data is stale, resolves the fee tier, and returns it with the OVERRIDE_FEE_FLAG so the PoolManager applies our fee instead of the default. The updateDepegState function is what Reactive Network calls through its callback proxy on Unichain — it's gated so only the authorized callback source or the owner can update state. And if the Reactive Network callback stops arriving for any reason — network issue, gas exhaustion — staleness kicks in after one hour and fees go to a conservative 30 basis point fallback. The hook is safe even when the monitoring is down."

---

### Run the Tests (2:40 – 3:00)

**Action:** Switch to terminal, run `forge test`

**Say:**
"Let me run the full test suite. We have 54 tests across three suites — 32 unit tests for the hook covering fee tiers, staleness, access control, events, actual swap execution through the PoolManager, and multi-stablecoin support. 13 tests for the reactive contract covering severity classification, confirmation logic, and callback emission. And 9 end-to-end tests that simulate the complete pipeline — reactive event triggers hook state change, hook overrides fee, swap executes with the correct fee. All 54 pass."

> **Wait for tests to finish on screen — the green wall of PASS is visually compelling**

---

## PART 3: Live Demo on Unichain Sepolia (3:00 – 4:20)

### Show the Dashboard (3:00 – 3:15)

**Action:** Switch to browser showing `http://localhost:3000`

**Say:**
"This is our live dashboard. Notice the header — it shows 'Unichain Sepolia' with a link to the deployed hook contract on Blockscout. This isn't a mock. Everything you're about to see is hitting real deployed contracts."

> **Point out:** Green dot + "Unichain Sepolia" + the contract address link in the header

---

### Connect Wallet & Read On-Chain State (3:15 – 3:30)

**Action:** Click "Connect Wallet". MetaMask opens. Approve connection.

**Say:**
"I'll connect to the deployed hook on Unichain Sepolia. The dashboard reads the current on-chain depeg state — severity is NONE, drift is zero, fee is 5 basis points. The pool is in normal operation."

---

### Simulate Escalation: NONE → MILD → SEVERE → CRITICAL (3:30 – 4:00)

**Action:** Click MILD. Wait for the transition animation. Then click SEVERE. Then CRITICAL.

**Say (on MILD click):**
"Now let's simulate a depeg. I'll trigger a MILD state — 1% drift. Watch the severity badge change and the fee jump to 30 basis points. In production, this would be triggered automatically by Reactive Network, but for the demo I'm calling setDepegState directly on the hook."

**Say (on SEVERE click):**
"Escalating to SEVERE — 3% drift. Fee goes to 1%. LPs are now being compensated for the increased risk, and the higher fee discourages arbitrageurs from draining the pool."

**Say (on CRITICAL click):**
"And CRITICAL — 7% drift. The fee is now 5%. At this level, it's extremely expensive to swap against the pool. This is maximum LP protection. In the March 2023 scenario, this would have saved millions."

> **Key visual:** The fee progress bar fills dramatically from tiny to full red. Let it breathe on screen for a moment.

---

### Recovery (4:00 – 4:20)

**Action:** Click NONE.

**Say:**
"And now recovery. The peg is restored, drift drops to near-zero, fees go back to 5 basis points. The entire cycle — detection, escalation, protection, recovery — is autonomous. No governance vote. No multisig. No keeper bot. Just Reactive Network watching Ethereum and Uniswap v4 on Unichain responding in real-time."

---

## PART 4: Close Strong (4:20 – 4:50)

### Final Slide

> **Screen:**
>
> **SentinelPeg — What we built**
>
> A Uniswap v4 hook that turns depeg events from LP catastrophes into managed risk
>
> **Deployed & wired on testnet:**
> - Hook: `0x8051EE84...6080` — Unichain Sepolia
> - Reactive: `0x330eFe22...cC60` — Reactive Lasna
> - Callback proxy configured, cross-chain pipeline live
>
> **By the numbers:**
> - 3 chains (Ethereum → Reactive → Unichain)
> - 4 severity tiers with graduated fee response
> - 54 tests, 0 failures
> - Full Next.js dashboard with on-chain interaction
>
> **Partner integrations:**
> - Unichain — native v4 hook deployment, PoolManager singleton
> - Reactive Network — trustless cross-chain event monitoring & callbacks

**Say:**
"SentinelPeg turns depeg events from LP catastrophes into managed risk. It's deployed on Unichain Sepolia with the Reactive Network integration live on Lasna — three chains wired together, 54 tests passing, a full dashboard. The next stablecoin depeg doesn't have to be a disaster. Thank you."

---

## Recording Checklist

**Before recording:**
- [ ] Frontend running at localhost:3000
- [ ] MetaMask on Unichain Sepolia network with ETH for gas
- [ ] Terminal ready with `forge test` typed but not run
- [ ] VS Code open with both .sol files tabbed
- [ ] Slides ready (use Google Slides, Keynote, or Canva)

**Recording tips:**
1. **Tool:** Loom (free, easiest) or OBS (more control)
2. **Resolution:** 1080p, clean desktop, dark theme everywhere
3. **Audio:** Speak with energy — you built something real, sound like it
4. **Pacing:** Don't rush the frontend demo. Let the animations play. The visual transitions sell the product.
5. **If you mess up:** Just keep going. A natural delivery beats a robotic perfect one.
6. **Upload to:** YouTube (unlisted) or Loom

**Submission checklist:**
- [ ] Submission Type: "Uniswap Hook Incubator (UHI)"
- [ ] Partners selected: **Reactive Network** AND **Unichain**
- [ ] Links: demo video URL + `https://github.com/Sandijigs/SenitelPeg`
- [ ] README has partner integrations section with code references
