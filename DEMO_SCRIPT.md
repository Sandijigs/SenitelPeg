# SentinelPeg Demo Video Script

**Target duration: 4–5 minutes**
**Format: Slides (intro) -> Code walkthrough -> Live frontend demo -> Wrap up**

---

## PART 1: Slides (0:00 – 1:30)

### Slide 1 — Title (0:00 – 0:10)
> **SentinelPeg**
> Real-time depeg defense for stablecoin pools on Uniswap v4
> Hookathon — UHI8 "Specialized Markets"

**Say:**
"Hi, I'm [Your Name]. This is SentinelPeg — an autonomous depeg defense system for stablecoin liquidity pools on Uniswap v4."

---

### Slide 2 — The Problem (0:10 – 0:40)
> **The Problem: LPs are unprotected during depeg events**
>
> - March 2023: USDC depegged to $0.87 — LPs absorbed millions in losses
> - Current defenses are manual, centralized, or non-existent
> - No decentralized, cross-chain depeg protection exists for Uniswap v4

**Say:**
"When USDC depegged in March 2023, stablecoin LPs had no automated protection. They either withdrew manually — too slow — or relied on centralized bots. Most pools had no protection at all. There's no decentralized, cross-chain depeg defense for Uniswap v4 today."

---

### Slide 3 — The Solution (0:40 – 1:10)
> **SentinelPeg: Autonomous depeg defense**
>
> 1. Monitor: Reactive Smart Contract watches stablecoin reserves on Ethereum
> 2. Classify: Price drift is classified into severity tiers (NONE → MILD → SEVERE → CRITICAL)
> 3. Protect: Uniswap v4 hook dynamically adjusts swap fees via beforeSwap
>
> | Severity | Drift    | Fee   |
> |----------|----------|-------|
> | NONE     | < 0.5%   | 0.05% |
> | MILD     | 0.5%–2%  | 0.30% |
> | SEVERE   | 2%–5%    | 1.00% |
> | CRITICAL | > 5%     | 5.00% |

**Say:**
"SentinelPeg solves this with three steps. First, a Reactive Smart Contract on Reactive Network monitors stablecoin pool reserves on Ethereum in real-time. Second, it classifies the price drift into severity tiers. Third, our Uniswap v4 hook dynamically adjusts swap fees through the beforeSwap callback — from 0.05% during normal operation up to 5% during a crisis. Fees return to normal automatically as the peg recovers."

---

### Slide 4 — Architecture (1:10 – 1:30)
> **Cross-chain architecture: V2 monitoring → V4 protection**
>
> ```
> Ethereum (V2 Sync events)
>        ↓ subscribed
> Reactive Network (classify severity, emit Callback)
>        ↓ cross-chain callback
> Unichain (V4 Hook adjusts fees in beforeSwap)
> ```
>
> Partner integrations: **Reactive Network** + **Unichain**

**Say:**
"Here's the architecture. On Ethereum, we subscribe to Uniswap V2 Sync events — the most granular on-chain price signal. Reactive Network processes these events, classifies severity, and sends a cross-chain callback to our Uniswap v4 hook on Unichain. The hook then overrides swap fees in real-time. This is a live integration with Reactive Network and Unichain — not theoretical."

---

## PART 2: Code Walkthrough (1:30 – 3:00)

### Show SentinelPegReactive.sol (1:30 – 2:00)

**Open:** `src/SentinelPegReactive.sol`

**Show these sections:**
- Constructor (line ~130): `service.subscribe()` call to Reactive Network system contract
- `react()` function (line ~168): Event processing pipeline
- `_classifySeverity()` (line ~237): Drift threshold classification
- Confirmation logic (line ~183): 2 consecutive readings required (except CRITICAL)

**Say:**
"This is our Reactive Smart Contract. In the constructor, we subscribe to Sync events from a Uniswap V2 pool through the Reactive Network system contract. When an event arrives, the react function decodes reserves, calculates price drift, and classifies severity. We require two consecutive readings at the same severity to filter noise from sandwich attacks — but CRITICAL severity fires immediately because you can't afford to wait during a 5%+ depeg."

---

### Show SentinelPegHook.sol (2:00 – 2:30)

**Open:** `src/SentinelPegHook.sol`

**Show these sections:**
- `_beforeSwap()` (line ~137): Fee resolution logic
- `_resolveFee()` (line ~242): Pool lookup → staleness check → severity-based fee
- `updateDepegState()` (line ~169): Callback receiver from Reactive Network
- `_isStale()` (line ~257): Staleness protection

**Say:**
"This is the Uniswap v4 hook. The beforeSwap callback resolves the fee dynamically — it looks up which stablecoin a pool tracks, checks if the data is stale, and returns the fee tier matching the current severity. The updateDepegState function receives cross-chain callbacks from Reactive Network. And if no callback arrives for over an hour, staleness kicks in and fees go to a conservative fallback — so the hook is safe even if the monitoring goes down."

---

### Show Tests (2:30 – 3:00)

**Run in terminal:**
```bash
forge test -vvv
```

**Say:**
"We have 54 tests across three suites — 32 hook unit tests, 13 reactive contract tests, and 9 end-to-end integration tests. They cover fee tiers, staleness logic, access control, events, swap integration, multi-stablecoin support, the full reactive-to-hook pipeline, and edge cases like noise filtering and rapid state changes. All 54 pass."

---

## PART 3: Live Frontend Demo (3:00 – 4:15)

### Show the Dashboard (3:00 – 3:15)

**Open browser:** `http://localhost:3000`

**Say:**
"This is our live dashboard built with Next.js and Tailwind. It connects to the deployed hook on Unichain Sepolia."

---

### Connect Wallet (3:15 – 3:30)

**Click** "Connect Wallet" button. MetaMask popup appears. Connect.

**Say:**
"I'll connect my wallet. The dashboard reads the current on-chain state from the deployed hook — you can see the severity is NONE, the fee is 0.05%, and there's no drift."

---

### Simulate MILD Depeg (3:30 – 3:45)

**Click** the MILD simulation button.

**Say:**
"Let's simulate a mild depeg — a 1% drift. Watch the severity card change to MILD and the fee jump to 0.30%. This is sending an actual transaction to the hook on Unichain Sepolia."

---

### Simulate CRITICAL Depeg (3:45 – 4:00)

**Click** the CRITICAL simulation button.

**Say:**
"Now a critical depeg — over 5% drift. The fee spikes to 5%, creating maximum LP protection. In production, this would make it extremely expensive to drain the pool during a crisis."

---

### Simulate Recovery (4:00 – 4:15)

**Click** the NONE simulation button.

**Say:**
"And when the peg recovers, fees drop back to 0.05%. The entire cycle is autonomous — no keeper bots, no manual intervention, no trust assumptions. Just Reactive Network monitoring and Uniswap v4 hooks."

---

## PART 4: Wrap Up (4:15 – 4:45)

### Final Slide — Summary
> **SentinelPeg — What makes it unique**
>
> - First cross-chain depeg defense system for Uniswap v4
> - Live Reactive Network integration (not theoretical)
> - Autonomous: no keepers, no centralized components
> - Graduated fee tiers with noise filtering and staleness protection
> - Deployed on Unichain Sepolia + Reactive Lasna
> - 54 tests, full frontend dashboard
>
> **Deployed Contracts:**
> - Hook: `0x8051EE84c86dBa66e72Bf51336e6059D41aa6080` (Unichain Sepolia)
> - Reactive: `0x330eFe22a73AAD374b887d6F77cd90fa16b6cC60` (Reactive Lasna)

**Say:**
"To wrap up — SentinelPeg is the first cross-chain depeg defense system for Uniswap v4. It uses a real Reactive Network integration for autonomous cross-chain monitoring, graduated fee tiers with noise filtering, and staleness protection. Both contracts are deployed on testnet and the full system is wired end-to-end. Thank you."

---

## Recording Tips

1. **Tools:** Use Loom (free, easy) or OBS (more control)
2. **Resolution:** 1080p minimum
3. **Audio:** Use a decent mic, speak clearly and at a moderate pace
4. **Screen layout:** Use split screen — slides on one side, VS Code on the other during code walkthrough
5. **Practice once** before recording — the script above is ~4:30, leaving buffer
6. **Upload to:** YouTube (unlisted) or Loom, paste the link in your submission
