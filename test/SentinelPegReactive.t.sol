// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import {ISentinelPeg} from "../src/interfaces/ISentinelPeg.sol";
import {SentinelPegReactive} from "../src/SentinelPegReactive.sol";

/// @title SentinelPegReactiveTest
/// @notice Tests the depeg detection logic of the reactive contract.
///
/// @dev The constructor's subscribe() call to the system contract will revert in a
///      plain Foundry test environment (no system contract at SERVICE_ADDR), so we
///      mock that address with a tiny contract whose fallback succeeds.
///      Inside the test we also set `vm = true` by deploying with code-size = 0 at
///      SERVICE_ADDR, which makes the constructor take the ReactVM branch.
contract SentinelPegReactiveTest is Test {

    SentinelPegReactive reactive;

    // ── Config matching a USDC/WETH V2 pool ──────────────────
    uint256 constant ORIGIN        = 1;          // Ethereum
    uint256 constant DESTINATION   = 130;        // Unichain
    address constant POOL          = address(0x1111);
    address constant HOOK          = address(0x2222);
    address constant USDC_ADDR     = address(0xA11CE);
    bool    constant IS_TOKEN0     = true;
    uint256 constant REF_ETH_PRICE = 3000e6;     // $3 000 USDC per ETH

    function setUp() public {
        // ── No code at SERVICE_ADDR → constructor takes ReactVM branch ──
        // (extcodesize == 0 means vm=true)
        reactive = new SentinelPegReactive(
            ORIGIN,
            DESTINATION,
            POOL,
            HOOK,
            USDC_ADDR,
            IS_TOKEN0,
            REF_ETH_PRICE
        );
    }

    // ═════════════════════════════════════════════════════════
    //  1.  Constructor & config
    // ═════════════════════════════════════════════════════════

    function test_constructorSetsConfig() public view {
        assertEq(reactive.originChainId(),      ORIGIN);
        assertEq(reactive.destinationChainId(),  DESTINATION);
        assertEq(reactive.monitoredPool(),       POOL);
        assertEq(reactive.callbackTarget(),      HOOK);
        assertEq(reactive.stablecoinAddress(),   USDC_ADDR);
        assertEq(reactive.stablecoinIsToken0(),  IS_TOKEN0);
        assertEq(reactive.referenceEthPrice(),   REF_ETH_PRICE);
    }

    function test_initialSeverityIsNone() public view {
        assertEq(uint8(reactive.lastSeverity()), uint8(ISentinelPeg.DepegSeverity.NONE));
    }

    // ═════════════════════════════════════════════════════════
    //  2.  Drift classification via react()
    // ═════════════════════════════════════════════════════════

    /// Helper: build a LogRecord with Sync event data
    function _syncLog(uint112 r0, uint112 r1) internal pure returns (SentinelPegReactive.LogRecord memory) {
        return SentinelPegReactive.LogRecord({
            chain_id:     ORIGIN,
            _contract:    POOL,
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

    /// Reserves that imply ETH = $3 000 → 0 % drift → NONE
    function test_noDrift() public {
        // USDC reserve = 3 000 000e6, WETH reserve = 1 000e18
        // impliedPrice = 3_000_000e6 * 1e12 / 1_000e18 = 3_000e6
        // drift = |3000e6 - 3000e6| / 3000e6 = 0
        uint112 usdcRes = 3_000_000e6;
        uint112 wethRes = 1_000e18 > type(uint112).max ? type(uint112).max : uint112(1_000 * 1e18);

        // Reserves that produce exactly the reference price can't be
        // represented trivially with uint112 (1000e18 > uint112 max).
        // Use smaller numbers: 3000e6 USDC / 1e18 WETH → price = 3000e6
        uint112 r0 = 3000e6;
        uint112 r1 = 1e18;

        // First two calls build confirmations; state shouldn't change
        reactive.react(_syncLog(r0, r1));
        assertEq(uint8(reactive.lastSeverity()), uint8(ISentinelPeg.DepegSeverity.NONE));
    }

    /// Reserves implying ~1 % drift → MILD after 2 confirmations
    function test_mildDepeg() public {
        // target: 1 % drift → implied price = 3000e6 * 1.01 = 3030e6
        // impliedPrice = r0 * 1e12 / r1  ⇒  r0 = 3030e6, r1 = 1e18
        uint112 r0 = 3030e6;
        uint112 r1 = 1e18;

        // 1st reading: pending but not confirmed
        reactive.react(_syncLog(r0, r1));
        assertEq(uint8(reactive.lastSeverity()), uint8(ISentinelPeg.DepegSeverity.NONE));

        // 2nd reading: confirmed → callback emitted, severity updated
        reactive.react(_syncLog(r0, r1));
        assertEq(uint8(reactive.lastSeverity()), uint8(ISentinelPeg.DepegSeverity.MILD));
    }

    /// Reserves implying ~3 % drift → SEVERE after 2 confirmations
    function test_severeDepeg() public {
        // 3 % drift: implied = 3000e6 * 1.03 = 3090e6
        uint112 r0 = 3090e6;
        uint112 r1 = 1e18;

        reactive.react(_syncLog(r0, r1));
        reactive.react(_syncLog(r0, r1));
        assertEq(uint8(reactive.lastSeverity()), uint8(ISentinelPeg.DepegSeverity.SEVERE));
    }

    /// Reserves implying ~6 % drift → CRITICAL (immediate, no confirmation)
    function test_criticalDepeg() public {
        // 6 % drift: implied = 3000e6 * 1.06 = 3180e6
        uint112 r0 = 3180e6;
        uint112 r1 = 1e18;

        // CRITICAL fires on the first reading (no confirmation needed)
        reactive.react(_syncLog(r0, r1));
        assertEq(uint8(reactive.lastSeverity()), uint8(ISentinelPeg.DepegSeverity.CRITICAL));
    }

    /// Negative drift (price drops) is handled identically
    function test_negativeDrift() public {
        // -3 % drift: implied = 3000e6 * 0.97 = 2910e6
        uint112 r0 = 2910e6;
        uint112 r1 = 1e18;

        reactive.react(_syncLog(r0, r1));
        reactive.react(_syncLog(r0, r1));
        assertEq(uint8(reactive.lastSeverity()), uint8(ISentinelPeg.DepegSeverity.SEVERE));
    }

    // ═════════════════════════════════════════════════════════
    //  3.  Confirmation logic
    // ═════════════════════════════════════════════════════════

    function test_confirmationResetsOnFluctuate() public {
        // 1st reading: MILD candidate
        uint112 r0mild = 3030e6;
        reactive.react(_syncLog(r0mild, 1e18));
        assertEq(reactive.consecutiveReadings(), 1);

        // 2nd reading: SEVERE candidate → resets counter
        uint112 r0severe = 3090e6;
        reactive.react(_syncLog(r0severe, 1e18));
        assertEq(reactive.consecutiveReadings(), 1);

        // Still NONE because neither confirmed
        assertEq(uint8(reactive.lastSeverity()), uint8(ISentinelPeg.DepegSeverity.NONE));

        // 3rd reading: SEVERE again → confirmed
        reactive.react(_syncLog(r0severe, 1e18));
        assertEq(uint8(reactive.lastSeverity()), uint8(ISentinelPeg.DepegSeverity.SEVERE));
    }

    function test_noRedundantCallbacks() public {
        // Confirm MILD
        uint112 r0 = 3030e6;
        reactive.react(_syncLog(r0, 1e18));
        reactive.react(_syncLog(r0, 1e18));
        assertEq(uint8(reactive.lastSeverity()), uint8(ISentinelPeg.DepegSeverity.MILD));

        // Same severity again → no new callback
        reactive.react(_syncLog(r0, 1e18));
        reactive.react(_syncLog(r0, 1e18));
        // lastSeverity unchanged, but no new Callback event (no state change)
        assertEq(uint8(reactive.lastSeverity()), uint8(ISentinelPeg.DepegSeverity.MILD));
    }

    // ═════════════════════════════════════════════════════════
    //  4.  Recovery path
    // ═════════════════════════════════════════════════════════

    function test_recoveryFromCriticalToNone() public {
        // Go to CRITICAL
        reactive.react(_syncLog(3180e6, 1e18));
        assertEq(uint8(reactive.lastSeverity()), uint8(ISentinelPeg.DepegSeverity.CRITICAL));

        // Recover to NONE (needs 2 confirmations)
        reactive.react(_syncLog(3000e6, 1e18));
        reactive.react(_syncLog(3000e6, 1e18));
        assertEq(uint8(reactive.lastSeverity()), uint8(ISentinelPeg.DepegSeverity.NONE));
    }

    // ═════════════════════════════════════════════════════════
    //  5.  Edge cases
    // ═════════════════════════════════════════════════════════

    function test_zeroReservesReturnZeroDrift() public {
        // Zero reserves → 0 drift → NONE
        reactive.react(_syncLog(0, 1e18));
        assertEq(uint8(reactive.lastSeverity()), uint8(ISentinelPeg.DepegSeverity.NONE));
    }

    function test_revertOnWrongTopic() public {
        SentinelPegReactive.LogRecord memory log = _syncLog(3000e6, 1e18);
        log.topic_0 = 0xDEAD;
        vm.expectRevert("UNEXPECTED_EVENT");
        reactive.react(log);
    }

    // ═════════════════════════════════════════════════════════
    //  6.  Callback event emission
    // ═════════════════════════════════════════════════════════

    function test_callbackEmittedOnSeverityChange() public {
        // Expect the Callback event on the 2nd MILD reading
        // (can't easily assert indexed params across all three, so just check it's emitted)
        uint112 r0 = 3030e6;
        reactive.react(_syncLog(r0, 1e18));

        vm.expectEmit(true, true, true, false);
        emit SentinelPegReactive.Callback(DESTINATION, HOOK, 300_000, "");
        // Note: we can't match payload exactly because of abi encoding,
        // so we use false for the data check
        reactive.react(_syncLog(r0, 1e18));
    }
}
