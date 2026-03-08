// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import {SentinelPegReactive} from "../src/SentinelPegReactive.sol";

/// @title DeployReactive
/// @notice Deploys SentinelPegReactive to the Reactive Network.
///
/// @dev The constructor automatically subscribes to Sync events on the origin chain
///      via the Reactive Network system contract.  Ensure the deployer account has
///      enough REACT tokens for callback gas payments.
///
///      Usage:
///        source .env
///        forge script script/DeployReactive.s.sol \
///          --rpc-url $REACTIVE_RPC_URL \
///          --private-key $REACTIVE_PRIVATE_KEY \
///          --broadcast \
///          --value 0.01ether
contract DeployReactive is Script {

    // ── Origin chain config (Ethereum mainnet) ───────────────
    uint256 constant ORIGIN_CHAIN_ID = 1;

    // Uniswap V2 USDC/ETH pool on Ethereum
    address constant USDC_ETH_POOL = 0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc;
    bool    constant STABLECOIN_IS_TOKEN0 = true;

    // ── Destination chain config (Unichain) ──────────────────
    uint256 constant DESTINATION_CHAIN_ID = 130;

    // SentinelPegHook address on Unichain  (fill after deploying hook)
    address constant HOOK_ADDRESS = address(0);     // TODO: set after hook deployment

    // Stablecoin address that the hook tracks
    address constant STABLECOIN = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;  // USDC

    // Reference ETH price in USDC base units (6 decimals). $3 000 = 3000e6
    uint256 constant REF_ETH_PRICE = 3000e6;

    function run() external {
        require(HOOK_ADDRESS != address(0), "Set HOOK_ADDRESS first");

        vm.startBroadcast();

        SentinelPegReactive reactive = new SentinelPegReactive{value: 0.01 ether}(
            ORIGIN_CHAIN_ID,
            DESTINATION_CHAIN_ID,
            USDC_ETH_POOL,
            HOOK_ADDRESS,
            STABLECOIN,
            STABLECOIN_IS_TOKEN0,
            REF_ETH_PRICE
        );

        vm.stopBroadcast();

        console.log("SentinelPegReactive deployed at:", address(reactive));
        console.log("Monitoring pool:", USDC_ETH_POOL);
        console.log("Callback target:", HOOK_ADDRESS);
    }
}
