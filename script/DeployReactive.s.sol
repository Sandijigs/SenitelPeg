// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import {SentinelPegReactive} from "../src/SentinelPegReactive.sol";

/// @title DeployReactive
/// @notice Deploys SentinelPegReactive to the Reactive Network.
///
/// @dev The constructor automatically subscribes to Sync events on the origin chain
///      via the Reactive Network system contract. Ensure the deployer account has
///      enough REACT tokens for callback gas payments (0.1 ether sent with deployment).
///
///      Usage:
///        source .env
///        forge script script/DeployReactive.s.sol \
///          --rpc-url $REACTIVE_RPC_URL \
///          --private-key $REACTIVE_PRIVATE_KEY \
///          --broadcast
contract DeployReactive is Script {
    function run() external {
        // ── Read config from environment ─────────────────────────
        uint256 originChainId      = vm.envUint("ETHEREUM_CHAIN_ID");
        uint256 destinationChainId = vm.envUint("UNICHAIN_CHAIN_ID");
        address usdcEthPool        = vm.envAddress("USDC_ETH_POOL");
        address hookAddress        = vm.envAddress("HOOK_ADDRESS");
        address stablecoin         = vm.envAddress("USDC_ADDRESS");
        bool    stablecoinIsToken0 = vm.envBool("STABLECOIN_IS_TOKEN0");
        uint256 refEthPrice        = vm.envUint("REFERENCE_ETH_PRICE");

        // ── Validate ─────────────────────────────────────────────
        require(hookAddress != address(0), "HOOK_ADDRESS not set in .env - deploy hook first");
        require(usdcEthPool != address(0), "USDC_ETH_POOL not set in .env");
        require(stablecoin != address(0), "USDC_ADDRESS not set in .env");
        require(refEthPrice > 0, "REFERENCE_ETH_PRICE must be > 0");

        console.log("Deploying SentinelPegReactive...");
        console.log("  Origin chain:     ", originChainId);
        console.log("  Destination chain: ", destinationChainId);
        console.log("  Monitored pool:   ", usdcEthPool);
        console.log("  Callback target:  ", hookAddress);
        console.log("  Stablecoin:       ", stablecoin);
        console.log("  Ref ETH price:    $%s", vm.toString(refEthPrice));

        // ── Deploy ───────────────────────────────────────────────
        vm.startBroadcast();

        SentinelPegReactive reactive = new SentinelPegReactive{value: 0.1 ether}(
            originChainId,
            destinationChainId,
            usdcEthPool,
            hookAddress,
            stablecoin,
            stablecoinIsToken0,
            refEthPrice
        );

        vm.stopBroadcast();

        // ── Output ───────────────────────────────────────────────
        console.log("");
        console.log("=== SentinelPeg Reactive Deployed ===");
        console.log("  Reactive address:", address(reactive));
        console.log("  Monitoring pool: ", usdcEthPool);
        console.log("  Callback target: ", hookAddress);
        console.log("");
        console.log("Next steps:");
        console.log("  1. Set REACTIVE_CONTRACT_ADDRESS=%s in .env", vm.toString(address(reactive)));
        console.log("  2. On Unichain, register pool & set callback source:");
        console.log("     cast send $HOOK_ADDRESS 'setCallbackSource(address)' <REACTIVE_CALLBACK_PROXY>");
    }
}
