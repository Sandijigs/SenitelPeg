// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {LPFeeLibrary} from "v4-core/src/libraries/LPFeeLibrary.sol";
import {SentinelPegHook} from "../src/SentinelPegHook.sol";

/// @title ConfigureHook
/// @notice Post-deployment configuration: register pool and set callback source.
///
/// @dev Run this AFTER deploying both the hook (Unichain) and the reactive contract
///      (Reactive Network). This script:
///        1. Sets the Reactive Network callback proxy as the authorised callback source
///        2. Registers a stablecoin pool so the hook knows which stablecoin to track
///
///      Usage:
///        source .env
///        forge script script/ConfigureHook.s.sol \
///          --rpc-url $UNICHAIN_RPC_URL \
///          --private-key $UNICHAIN_PRIVATE_KEY \
///          --broadcast
contract ConfigureHook is Script {
    function run() external {
        // ── Read config from environment ─────────────────────────
        address hookAddress       = vm.envAddress("HOOK_ADDRESS");
        address callbackProxy     = vm.envAddress("REACTIVE_CALLBACK_PROXY");
        address stablecoin        = vm.envAddress("USDC_ADDRESS");

        // Pool token addresses (currency0 must be < currency1)
        address currency0         = vm.envAddress("POOL_CURRENCY0");
        address currency1         = vm.envAddress("POOL_CURRENCY1");
        int24   tickSpacing       = int24(vm.envInt("POOL_TICK_SPACING"));

        // ── Validate ─────────────────────────────────────────────
        require(hookAddress != address(0), "HOOK_ADDRESS not set");
        require(callbackProxy != address(0), "REACTIVE_CALLBACK_PROXY not set");
        require(stablecoin != address(0), "USDC_ADDRESS not set");
        require(currency0 < currency1, "currency0 must be < currency1");

        SentinelPegHook hook = SentinelPegHook(hookAddress);

        // ── Build PoolKey ────────────────────────────────────────
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(currency0),
            currency1: Currency.wrap(currency1),
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: tickSpacing,
            hooks: hook
        });

        console.log("Configuring SentinelPegHook at:", hookAddress);

        vm.startBroadcast();

        // 1. Set callback source (Reactive Network proxy)
        hook.setCallbackSource(callbackProxy);
        console.log("  Callback source set to:", callbackProxy);

        // 2. Register the stablecoin pool
        hook.registerPool(key, stablecoin);
        console.log("  Pool registered for stablecoin:", stablecoin);

        vm.stopBroadcast();

        console.log("");
        console.log("=== Hook Configuration Complete ===");
        console.log("  The hook is now live and will apply dynamic fees");
        console.log("  based on depeg severity from Reactive Network callbacks.");
    }
}
