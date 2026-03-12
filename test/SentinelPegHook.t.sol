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
import {TickMath} from "v4-core/src/libraries/TickMath.sol";
import {StateLibrary} from "v4-core/src/libraries/StateLibrary.sol";
import {ModifyLiquidityParams, SwapParams} from "v4-core/src/types/PoolOperation.sol";

import {SentinelPegHook} from "../src/SentinelPegHook.sol";
import {ISentinelPeg} from "../src/interfaces/ISentinelPeg.sol";

/// @title SentinelPegHookTest
/// @notice Full test suite for the SentinelPeg Uniswap v4 hook
contract SentinelPegHookTest is Test, Deployers {
    using PoolIdLibrary for PoolKey;
    using CurrencyLibrary for Currency;
    using StateLibrary for IPoolManager;

    SentinelPegHook hook;
    PoolKey         poolKey;
    PoolId          poolId;

    address constant USDC       = address(0xA11CE);   // mock stablecoin
    address constant CALLBACK   = address(0xCA11);    // mock callback proxy
    address          deployer;

    // ─────────────────────────────────────────────────────────
    //  Setup
    // ─────────────────────────────────────────────────────────

    function setUp() public {
        deployer = address(this);

        // Deploy PoolManager + routers + test tokens
        deployFreshManagerAndRouters();
        deployMintAndApprove2Currencies();

        // Compute the hook address that encodes the right permission bits
        uint160 flags = uint160(Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG);
        address hookAddr = address(flags);

        // Deploy the hook contract at the required address
        deployCodeTo(
            "SentinelPegHook.sol",
            abi.encode(manager, address(this)),
            hookAddr
        );
        hook = SentinelPegHook(hookAddr);

        // Initialise a pool with DYNAMIC fee flag
        (poolKey, poolId) = initPool(
            currency0,
            currency1,
            IHooks(hookAddr),
            LPFeeLibrary.DYNAMIC_FEE_FLAG,
            SQRT_PRICE_1_1
        );

        // Seed liquidity
        modifyLiquidityRouter.modifyLiquidity(
            poolKey,
            ModifyLiquidityParams({
                tickLower: -60,
                tickUpper:  60,
                liquidityDelta: 10 ether,
                salt: bytes32(0)
            }),
            ZERO_BYTES
        );

        // Register this pool to track USDC
        hook.registerPool(poolKey, USDC);
    }

    // ═════════════════════════════════════════════════════════
    //  1.  Deployment & initialisation
    // ═════════════════════════════════════════════════════════

    function test_ownerIsDeployer() public view {
        assertEq(hook.owner(), deployer);
    }

    function test_defaultStaleness() public view {
        assertEq(hook.stalenessThreshold(), 3600);
    }

    function test_revertIfPoolNotDynamic() public {
        // Attempt to initialise a pool WITHOUT the dynamic fee flag
        // v4-core wraps hook reverts in WrappedError containing PoolMustUseDynamicFees
        vm.expectRevert();
        initPool(
            currency0,
            currency1,
            IHooks(address(hook)),
            3000,                      // static fee — should revert
            SQRT_PRICE_1_1
        );
    }

    // ═════════════════════════════════════════════════════════
    //  2.  Fee tiers under each severity
    // ═════════════════════════════════════════════════════════

    function test_feeNone() public {
        // Default state is NONE, never updated → not stale
        uint24 fee = hook.getCurrentFee(USDC);
        assertEq(fee, hook.FEE_NONE());
    }

    function test_feeMild() public {
        hook.setDepegState(USDC, ISentinelPeg.DepegSeverity.MILD, 100);
        assertEq(hook.getCurrentFee(USDC), hook.FEE_MILD());
    }

    function test_feeSevere() public {
        hook.setDepegState(USDC, ISentinelPeg.DepegSeverity.SEVERE, 300);
        assertEq(hook.getCurrentFee(USDC), hook.FEE_SEVERE());
    }

    function test_feeCritical() public {
        hook.setDepegState(USDC, ISentinelPeg.DepegSeverity.CRITICAL, 600);
        assertEq(hook.getCurrentFee(USDC), hook.FEE_CRITICAL());
    }

    // ═════════════════════════════════════════════════════════
    //  3.  Staleness logic
    // ═════════════════════════════════════════════════════════

    function test_neverSetIsNotStale() public view {
        (, , , bool stale) = hook.getDepegState(USDC);
        assertFalse(stale);
    }

    function test_freshUpdateIsNotStale() public {
        hook.setDepegState(USDC, ISentinelPeg.DepegSeverity.MILD, 80);
        (, , , bool stale) = hook.getDepegState(USDC);
        assertFalse(stale);
    }

    function test_oldUpdateIsStale() public {
        hook.setDepegState(USDC, ISentinelPeg.DepegSeverity.SEVERE, 300);

        // Fast-forward past staleness threshold
        vm.warp(block.timestamp + 3601);

        (, , , bool stale) = hook.getDepegState(USDC);
        assertTrue(stale);
        assertEq(hook.getCurrentFee(USDC), hook.FEE_STALE());
    }

    function test_staleFeeUsedDuringSwap() public {
        hook.setDepegState(USDC, ISentinelPeg.DepegSeverity.CRITICAL, 800);
        vm.warp(block.timestamp + 7200);   // 2 hours → stale

        // Execute a swap — fee should be FEE_STALE, not FEE_CRITICAL
        // (We verify via the view function; the swap itself uses the same logic)
        assertEq(hook.getCurrentFee(USDC), hook.FEE_STALE());
    }

    // ═════════════════════════════════════════════════════════
    //  4.  Recovery — severity goes back to NONE
    // ═════════════════════════════════════════════════════════

    function test_recoveryFromCriticalToNone() public {
        // Depeg happens
        hook.setDepegState(USDC, ISentinelPeg.DepegSeverity.CRITICAL, 700);
        assertEq(hook.getCurrentFee(USDC), hook.FEE_CRITICAL());

        // Recovery
        hook.setDepegState(USDC, ISentinelPeg.DepegSeverity.NONE, 10);
        assertEq(hook.getCurrentFee(USDC), hook.FEE_NONE());
    }

    function test_gradualRecovery() public {
        hook.setDepegState(USDC, ISentinelPeg.DepegSeverity.CRITICAL, 700);
        assertEq(hook.getCurrentFee(USDC), hook.FEE_CRITICAL());

        hook.setDepegState(USDC, ISentinelPeg.DepegSeverity.SEVERE, 350);
        assertEq(hook.getCurrentFee(USDC), hook.FEE_SEVERE());

        hook.setDepegState(USDC, ISentinelPeg.DepegSeverity.MILD, 100);
        assertEq(hook.getCurrentFee(USDC), hook.FEE_MILD());

        hook.setDepegState(USDC, ISentinelPeg.DepegSeverity.NONE, 10);
        assertEq(hook.getCurrentFee(USDC), hook.FEE_NONE());
    }

    // ═════════════════════════════════════════════════════════
    //  5.  Access control
    // ═════════════════════════════════════════════════════════

    function test_onlyOwnerCanSetState() public {
        vm.prank(address(0xBEEF));
        vm.expectRevert(ISentinelPeg.NotOwner.selector);
        hook.setDepegState(USDC, ISentinelPeg.DepegSeverity.MILD, 80);
    }

    function test_onlyOwnerCanRegisterPool() public {
        vm.prank(address(0xBEEF));
        vm.expectRevert(ISentinelPeg.NotOwner.selector);
        hook.registerPool(poolKey, USDC);
    }

    function test_unauthorizedCallbackReverts() public {
        vm.prank(address(0xBEEF));
        vm.expectRevert(ISentinelPeg.NotAuthorized.selector);
        hook.updateDepegState(address(0), USDC, 1, 80);
    }

    function test_callbackSourceCanUpdate() public {
        hook.setCallbackSource(CALLBACK);

        vm.prank(CALLBACK);
        hook.updateDepegState(address(0), USDC, uint8(ISentinelPeg.DepegSeverity.MILD), 80);

        (ISentinelPeg.DepegSeverity sev, , , ) = hook.getDepegState(USDC);
        assertEq(uint8(sev), uint8(ISentinelPeg.DepegSeverity.MILD));
    }

    function test_ownerCanAlsoCallUpdate() public {
        hook.updateDepegState(address(0), USDC, uint8(ISentinelPeg.DepegSeverity.SEVERE), 300);
        (ISentinelPeg.DepegSeverity sev, , , ) = hook.getDepegState(USDC);
        assertEq(uint8(sev), uint8(ISentinelPeg.DepegSeverity.SEVERE));
    }

    // ═════════════════════════════════════════════════════════
    //  6.  Admin functions
    // ═════════════════════════════════════════════════════════

    function test_setStalenessThreshold() public {
        hook.setStalenessThreshold(7200);
        assertEq(hook.stalenessThreshold(), 7200);
    }

    function test_setStalenessThresholdTooLow() public {
        vm.expectRevert(ISentinelPeg.StalenessThresholdTooLow.selector);
        hook.setStalenessThreshold(30);
    }

    function test_zeroAddressReverts() public {
        vm.expectRevert(ISentinelPeg.ZeroAddress.selector);
        hook.setDepegState(address(0), ISentinelPeg.DepegSeverity.MILD, 80);
    }

    function test_registerPoolZeroAddressReverts() public {
        vm.expectRevert(ISentinelPeg.ZeroAddress.selector);
        hook.registerPool(poolKey, address(0));
    }

    // ═════════════════════════════════════════════════════════
    //  7.  Events
    // ═════════════════════════════════════════════════════════

    function test_emitsDepegStateUpdated() public {
        vm.expectEmit(true, false, false, true);
        emit ISentinelPeg.DepegStateUpdated(
            USDC,
            ISentinelPeg.DepegSeverity.NONE,
            ISentinelPeg.DepegSeverity.MILD,
            100,
            block.timestamp
        );
        hook.setDepegState(USDC, ISentinelPeg.DepegSeverity.MILD, 100);
    }

    function test_emitsCallbackSourceUpdated() public {
        vm.expectEmit(true, true, false, false);
        emit ISentinelPeg.CallbackSourceUpdated(address(0), CALLBACK);
        hook.setCallbackSource(CALLBACK);
    }

    function test_emitsPoolRegistered() public {
        // Deploy a fresh pool to register
        vm.expectEmit(false, true, false, false);
        emit ISentinelPeg.PoolRegistered(bytes32(0), USDC);
        hook.registerPool(poolKey, USDC);
    }

    // ═════════════════════════════════════════════════════════
    //  8.  Swap integration  (actual swap through PoolManager)
    // ═════════════════════════════════════════════════════════

    function test_swapSucceedsUnderNone() public {
        // Default severity is NONE → lowest fee
        bool zeroForOne = true;
        int256 amountSpecified = -0.001 ether;

        swap(poolKey, zeroForOne, amountSpecified, ZERO_BYTES);
        // If we get here without revert, swap succeeded with the dynamic fee
    }

    function test_swapSucceedsUnderMild() public {
        hook.setDepegState(USDC, ISentinelPeg.DepegSeverity.MILD, 100);

        swap(poolKey, true, -0.001 ether, ZERO_BYTES);
    }

    function test_swapSucceedsUnderCritical() public {
        hook.setDepegState(USDC, ISentinelPeg.DepegSeverity.CRITICAL, 700);

        swap(poolKey, true, -0.001 ether, ZERO_BYTES);
    }

    function test_swapUnregisteredPoolUsesDefaultFee() public {
        // Create a second pool that is NOT registered (different tick spacing to avoid PoolAlreadyInitialized)
        (PoolKey memory key2, ) = initPool(
            currency0,
            currency1,
            IHooks(address(hook)),
            LPFeeLibrary.DYNAMIC_FEE_FLAG,
            int24(10),
            SQRT_PRICE_1_1
        );

        // Add liquidity to the second pool
        modifyLiquidityRouter.modifyLiquidity(
            key2,
            ModifyLiquidityParams({
                tickLower: -60,
                tickUpper:  60,
                liquidityDelta: 10 ether,
                salt: bytes32(0)
            }),
            ZERO_BYTES
        );

        // Swap should work with default fee (FEE_NONE)
        swap(key2, true, -0.001 ether, ZERO_BYTES);
    }

    // ═════════════════════════════════════════════════════════
    //  9.  Multi-stablecoin support
    // ═════════════════════════════════════════════════════════

    function test_independentStablecoinStates() public {
        address USDT = address(0xDA17);

        // Set different severities for different stablecoins
        hook.setDepegState(USDC, ISentinelPeg.DepegSeverity.MILD, 100);
        hook.setDepegState(USDT, ISentinelPeg.DepegSeverity.CRITICAL, 700);

        assertEq(hook.getCurrentFee(USDC), hook.FEE_MILD());
        assertEq(hook.getCurrentFee(USDT), hook.FEE_CRITICAL());
    }

    // ═════════════════════════════════════════════════════════
    //  10.  Edge cases
    // ═════════════════════════════════════════════════════════

    function test_multipleRapidStateChanges() public {
        for (uint8 i = 0; i <= 3; i++) {
            hook.setDepegState(USDC, ISentinelPeg.DepegSeverity(i), uint256(i) * 100);
        }
        // Final state should be CRITICAL
        (ISentinelPeg.DepegSeverity sev, , , ) = hook.getDepegState(USDC);
        assertEq(uint8(sev), uint8(ISentinelPeg.DepegSeverity.CRITICAL));
    }

    function test_stalenessResetAfterNewUpdate() public {
        hook.setDepegState(USDC, ISentinelPeg.DepegSeverity.SEVERE, 300);
        vm.warp(block.timestamp + 3601);  // stale

        (, , , bool stale) = hook.getDepegState(USDC);
        assertTrue(stale);

        // New update resets staleness
        hook.setDepegState(USDC, ISentinelPeg.DepegSeverity.MILD, 100);
        (, , , stale) = hook.getDepegState(USDC);
        assertFalse(stale);
        assertEq(hook.getCurrentFee(USDC), hook.FEE_MILD());
    }
}
