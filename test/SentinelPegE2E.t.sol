// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import {Deployers} from "v4-core/test/utils/Deployers.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {Currency, CurrencyLibrary} from "v4-core/src/types/Currency.sol";
import {LPFeeLibrary} from "v4-core/src/libraries/LPFeeLibrary.sol";
import {BalanceDelta} from "v4-core/src/types/BalanceDelta.sol";
import {ModifyLiquidityParams} from "v4-core/src/types/PoolOperation.sol";

import {SentinelPegHook} from "../src/SentinelPegHook.sol";
import {SentinelPegReactive} from "../src/SentinelPegReactive.sol";
import {ISentinelPeg} from "../src/interfaces/ISentinelPeg.sol";

/// @title SentinelPegE2ETest
/// @notice End-to-end integration tests exercising both the reactive contract
///         and the hook contract together in a single flow:
///         Sync event → react() → callback relay → fee override → swap
contract SentinelPegE2ETest is Test, Deployers {
    using PoolIdLibrary for PoolKey;
    using CurrencyLibrary for Currency;

    SentinelPegHook hook;
    SentinelPegReactive reactive;

    PoolKey poolKey;
    PoolId  poolId;

    address constant USDC_ADDR = address(0xA11CE);
    address constant USDT_ADDR = address(0xDA17);
    address constant POOL_ETH  = address(0x1111); // mock Ethereum pool

    // ─────────────────────────────────────────────────────────
    //  Setup — deploy both contracts, initialise pool, seed liquidity
    // ─────────────────────────────────────────────────────────

    function setUp() public {
        // 1. Deploy v4 infrastructure
        deployFreshManagerAndRouters();
        deployMintAndApprove2Currencies();

        // 2. Deploy hook at permission-encoded address
        uint160 flags = uint160(Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG);
        address hookAddr = address(flags);
        deployCodeTo("SentinelPegHook.sol", abi.encode(manager, address(this)), hookAddr);
        hook = SentinelPegHook(hookAddr);

        // 3. Initialise pool with dynamic fee
        (poolKey, poolId) = initPool(
            currency0,
            currency1,
            IHooks(hookAddr),
            LPFeeLibrary.DYNAMIC_FEE_FLAG,
            SQRT_PRICE_1_1
        );

        // 4. Seed liquidity
        modifyLiquidityRouter.modifyLiquidity(
            poolKey,
            ModifyLiquidityParams({
                tickLower: -60,
                tickUpper: 60,
                liquidityDelta: 100 ether,
                salt: bytes32(0)
            }),
            ZERO_BYTES
        );

        // 5. Register pool → tracks USDC
        hook.registerPool(poolKey, USDC_ADDR);

        // 6. Deploy reactive contract (no code at SERVICE_ADDR → vm=true)
        reactive = new SentinelPegReactive(
            1,              // origin: Ethereum
            130,            // destination: Unichain
            POOL_ETH,       // monitored pool
            hookAddr,       // callback target
            USDC_ADDR,      // stablecoin
            true,           // stablecoin is token0
            3000            // reference ETH price (formula output units)
        );
    }

    // ─────────────────────────────────────────────────────────
    //  Helpers
    // ─────────────────────────────────────────────────────────

    /// @dev Build a Sync LogRecord with given reserves
    function _syncLog(uint112 r0, uint112 r1)
        internal view returns (SentinelPegReactive.LogRecord memory)
    {
        return SentinelPegReactive.LogRecord({
            chain_id:     1,
            _contract:    POOL_ETH,
            topic_0:      reactive.SYNC_TOPIC_0(),
            topic_1:      0,
            topic_2:      0,
            topic_3:      0,
            data:         abi.encode(r0, r1),
            block_number: 100,
            op_code:      0,
            block_hash:   0,
            tx_hash:      0,
            log_index:    0
        });
    }

    /// @dev Relay a depeg state update to the hook (simulates Reactive Network callback)
    function _relayCallback(ISentinelPeg.DepegSeverity severity, uint256 driftBps) internal {
        hook.updateDepegState(address(0), USDC_ADDR, uint8(severity), driftBps);
    }

    /// @dev Execute a standard swap and return the balance delta
    function _doSwap() internal returns (BalanceDelta) {
        return swap(poolKey, true, -0.001 ether, ZERO_BYTES);
    }

    // ═════════════════════════════════════════════════════════
    //  1. Normal market — no depeg
    // ═════════════════════════════════════════════════════════

    function test_e2e_normalMarketSwap() public {
        // Sync event with perfect-peg reserves
        reactive.react(_syncLog(3000e6, 1e18));

        // Reactive stays at NONE
        assertEq(
            uint8(reactive.lastSeverity()),
            uint8(ISentinelPeg.DepegSeverity.NONE),
            "reactive should stay NONE"
        );

        // Hook fee is FEE_NONE
        assertEq(hook.getCurrentFee(USDC_ADDR), hook.FEE_NONE());

        // Swap succeeds at normal fee
        _doSwap();
    }

    // ═════════════════════════════════════════════════════════
    //  2. Mild depeg — full cycle with confirmation
    // ═════════════════════════════════════════════════════════

    function test_e2e_mildDepegFullCycle() public {
        // --- Baseline swap at NONE ---
        BalanceDelta deltaNone = _doSwap();

        // --- 1st MILD reading (not yet confirmed) ---
        reactive.react(_syncLog(3030e6, 1e18)); // 1% drift
        assertEq(
            uint8(reactive.lastSeverity()),
            uint8(ISentinelPeg.DepegSeverity.NONE),
            "should not confirm after 1 reading"
        );

        // --- 2nd MILD reading (confirmed) ---
        reactive.react(_syncLog(3030e6, 1e18));
        assertEq(
            uint8(reactive.lastSeverity()),
            uint8(ISentinelPeg.DepegSeverity.MILD),
            "should confirm MILD after 2 readings"
        );

        // --- Relay callback to hook ---
        _relayCallback(ISentinelPeg.DepegSeverity.MILD, 100);
        assertEq(hook.getCurrentFee(USDC_ADDR), hook.FEE_MILD());

        // --- Swap at elevated fee ---
        BalanceDelta deltaMild = _doSwap();

        // Higher fee → less output (amount1 is positive = received by swapper)
        assertTrue(
            deltaMild.amount1() < deltaNone.amount1(),
            "MILD fee should yield less output than NONE"
        );
    }

    // ═════════════════════════════════════════════════════════
    //  3. Severe depeg — full cycle
    // ═════════════════════════════════════════════════════════

    function test_e2e_severeDepegFullCycle() public {
        // 2 SEVERE readings → confirmed
        reactive.react(_syncLog(3090e6, 1e18)); // 3% drift
        reactive.react(_syncLog(3090e6, 1e18));
        assertEq(
            uint8(reactive.lastSeverity()),
            uint8(ISentinelPeg.DepegSeverity.SEVERE)
        );

        // Relay to hook
        _relayCallback(ISentinelPeg.DepegSeverity.SEVERE, 300);
        assertEq(hook.getCurrentFee(USDC_ADDR), hook.FEE_SEVERE());

        // Swap succeeds at 1% fee
        _doSwap();
    }

    // ═════════════════════════════════════════════════════════
    //  4. Critical depeg — fires immediately, no confirmation
    // ═════════════════════════════════════════════════════════

    function test_e2e_criticalFiresImmediately() public {
        // Single CRITICAL reading → fires on first call
        reactive.react(_syncLog(3180e6, 1e18)); // 6% drift
        assertEq(
            uint8(reactive.lastSeverity()),
            uint8(ISentinelPeg.DepegSeverity.CRITICAL),
            "CRITICAL should fire on first reading"
        );

        // Relay to hook → max fee
        _relayCallback(ISentinelPeg.DepegSeverity.CRITICAL, 600);
        assertEq(hook.getCurrentFee(USDC_ADDR), hook.FEE_CRITICAL());

        // Pool is still operational — just very expensive
        _doSwap();
    }

    // ═════════════════════════════════════════════════════════
    //  5. Confirmation prevents noise
    // ═════════════════════════════════════════════════════════

    function test_e2e_confirmationPreventsNoise() public {
        // 1 MILD reading
        reactive.react(_syncLog(3030e6, 1e18));
        assertEq(reactive.consecutiveReadings(), 1);

        // Switch to SEVERE → counter resets
        reactive.react(_syncLog(3090e6, 1e18));
        assertEq(reactive.consecutiveReadings(), 1);

        // Neither confirmed — lastSeverity still NONE
        assertEq(
            uint8(reactive.lastSeverity()),
            uint8(ISentinelPeg.DepegSeverity.NONE),
            "fluctuating signals should not confirm"
        );

        // Hook untouched — still FEE_NONE
        assertEq(hook.getCurrentFee(USDC_ADDR), hook.FEE_NONE());

        // Swap at normal fee
        _doSwap();
    }

    // ═════════════════════════════════════════════════════════
    //  6. Full escalation NONE → MILD → SEVERE → CRITICAL → NONE
    // ═════════════════════════════════════════════════════════

    function test_e2e_fullEscalationAndRecovery() public {
        // --- Escalate to MILD ---
        reactive.react(_syncLog(3030e6, 1e18));
        reactive.react(_syncLog(3030e6, 1e18));
        assertEq(uint8(reactive.lastSeverity()), uint8(ISentinelPeg.DepegSeverity.MILD));
        _relayCallback(ISentinelPeg.DepegSeverity.MILD, 100);
        assertEq(hook.getCurrentFee(USDC_ADDR), hook.FEE_MILD());

        // --- Escalate to SEVERE ---
        reactive.react(_syncLog(3090e6, 1e18));
        reactive.react(_syncLog(3090e6, 1e18));
        assertEq(uint8(reactive.lastSeverity()), uint8(ISentinelPeg.DepegSeverity.SEVERE));
        _relayCallback(ISentinelPeg.DepegSeverity.SEVERE, 300);
        assertEq(hook.getCurrentFee(USDC_ADDR), hook.FEE_SEVERE());

        // --- Escalate to CRITICAL (immediate) ---
        reactive.react(_syncLog(3180e6, 1e18));
        assertEq(uint8(reactive.lastSeverity()), uint8(ISentinelPeg.DepegSeverity.CRITICAL));
        _relayCallback(ISentinelPeg.DepegSeverity.CRITICAL, 600);
        assertEq(hook.getCurrentFee(USDC_ADDR), hook.FEE_CRITICAL());

        // --- Recover to NONE (2 confirmations required) ---
        reactive.react(_syncLog(3000e6, 1e18));
        assertEq(
            uint8(reactive.lastSeverity()),
            uint8(ISentinelPeg.DepegSeverity.CRITICAL),
            "should still be CRITICAL after 1 recovery reading"
        );

        reactive.react(_syncLog(3000e6, 1e18));
        assertEq(uint8(reactive.lastSeverity()), uint8(ISentinelPeg.DepegSeverity.NONE));
        _relayCallback(ISentinelPeg.DepegSeverity.NONE, 0);
        assertEq(hook.getCurrentFee(USDC_ADDR), hook.FEE_NONE());

        // Swap at normal fee after full recovery
        _doSwap();
    }

    // ═════════════════════════════════════════════════════════
    //  7. Staleness protection
    // ═════════════════════════════════════════════════════════

    function test_e2e_stalenessKicksIn() public {
        // Set CRITICAL state
        _relayCallback(ISentinelPeg.DepegSeverity.CRITICAL, 700);
        assertEq(hook.getCurrentFee(USDC_ADDR), hook.FEE_CRITICAL());

        // Swap works at CRITICAL fee
        _doSwap();

        // --- Time passes with no updates ---
        vm.warp(block.timestamp + 3601); // 1 hour + 1 second

        // Fee falls back to STALE, NOT CRITICAL
        assertEq(hook.getCurrentFee(USDC_ADDR), hook.FEE_STALE());

        (, , , bool isStale) = hook.getDepegState(USDC_ADDR);
        assertTrue(isStale, "data should be stale after threshold");

        // Swap still works but at conservative fee
        _doSwap();

        // --- Fresh callback arrives → staleness resets ---
        _relayCallback(ISentinelPeg.DepegSeverity.SEVERE, 300);
        (, , , isStale) = hook.getDepegState(USDC_ADDR);
        assertFalse(isStale, "fresh update should clear staleness");
        assertEq(hook.getCurrentFee(USDC_ADDR), hook.FEE_SEVERE());
    }

    // ═════════════════════════════════════════════════════════
    //  8. Multi-stablecoin independence
    // ═════════════════════════════════════════════════════════

    function test_e2e_multiStablecoinIndependence() public {
        // Create a second pool with different tick spacing
        (PoolKey memory key2, ) = initPool(
            currency0,
            currency1,
            IHooks(address(hook)),
            LPFeeLibrary.DYNAMIC_FEE_FLAG,
            int24(10),
            SQRT_PRICE_1_1
        );

        // Add liquidity to second pool
        modifyLiquidityRouter.modifyLiquidity(
            key2,
            ModifyLiquidityParams({
                tickLower: -10,
                tickUpper: 10,
                liquidityDelta: 100 ether,
                salt: bytes32(0)
            }),
            ZERO_BYTES
        );

        // Register second pool for USDT
        hook.registerPool(key2, USDT_ADDR);

        // Set CRITICAL for USDC, leave USDT at NONE
        _relayCallback(ISentinelPeg.DepegSeverity.CRITICAL, 700);

        // Verify independence
        assertEq(hook.getCurrentFee(USDC_ADDR), hook.FEE_CRITICAL(), "USDC should be CRITICAL");
        assertEq(hook.getCurrentFee(USDT_ADDR), hook.FEE_NONE(), "USDT should be NONE");

        // Swap USDC pool → expensive
        BalanceDelta deltaUSDC = _doSwap();

        // Swap USDT pool → cheap
        BalanceDelta deltaUSDT = swap(key2, true, -0.001 ether, ZERO_BYTES);

        // USDT pool should give better output (lower fee)
        assertTrue(
            deltaUSDT.amount1() > deltaUSDC.amount1(),
            "USDT (NONE fee) should yield more output than USDC (CRITICAL fee)"
        );
    }

    // ═════════════════════════════════════════════════════════
    //  9. Fee impact on swap output — LP protection proof
    // ═════════════════════════════════════════════════════════

    function test_e2e_feeImpactOnSwapOutput() public {
        int256 swapAmount = -0.001 ether;

        // --- Swap at NONE ---
        BalanceDelta deltaNone = swap(poolKey, true, swapAmount, ZERO_BYTES);

        // --- Swap at MILD ---
        _relayCallback(ISentinelPeg.DepegSeverity.MILD, 100);
        BalanceDelta deltaMild = swap(poolKey, true, swapAmount, ZERO_BYTES);

        // --- Swap at SEVERE ---
        _relayCallback(ISentinelPeg.DepegSeverity.SEVERE, 300);
        BalanceDelta deltaSevere = swap(poolKey, true, swapAmount, ZERO_BYTES);

        // --- Swap at CRITICAL ---
        _relayCallback(ISentinelPeg.DepegSeverity.CRITICAL, 700);
        BalanceDelta deltaCritical = swap(poolKey, true, swapAmount, ZERO_BYTES);

        // Verify: higher severity → less output for the swapper
        // (amount1 is the output token, positive = received by swapper)
        assertTrue(
            deltaNone.amount1() > deltaMild.amount1(),
            "NONE should yield more than MILD"
        );
        assertTrue(
            deltaMild.amount1() > deltaSevere.amount1(),
            "MILD should yield more than SEVERE"
        );
        assertTrue(
            deltaSevere.amount1() > deltaCritical.amount1(),
            "SEVERE should yield more than CRITICAL"
        );

        // Log for demo visibility
        emit log_named_int("Output at NONE     (0.05%)", deltaNone.amount1());
        emit log_named_int("Output at MILD     (0.30%)", deltaMild.amount1());
        emit log_named_int("Output at SEVERE   (1.00%)", deltaSevere.amount1());
        emit log_named_int("Output at CRITICAL (5.00%)", deltaCritical.amount1());
    }
}
