// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {SentinelPegHook} from "../src/SentinelPegHook.sol";

/// @title DeployHook
/// @notice Deploys SentinelPegHook to Unichain with the correct address prefix.
///
/// @dev Uniswap v4 hooks must be deployed at addresses whose leading bits encode the
///      enabled hook permissions.  We use CREATE2 via a deterministic deployer to mine
///      an address that starts with the correct flag bits.
///
///      Usage:
///        forge script script/DeployHook.s.sol \
///          --rpc-url $UNICHAIN_RPC_URL \
///          --private-key $UNICHAIN_PRIVATE_KEY \
///          --broadcast
contract DeployHook is Script {
    // Uniswap v4 PoolManager on Unichain (update after checking deployment addresses)
    address constant POOL_MANAGER = address(0);  // TODO: set to actual PoolManager on Unichain

    function run() external {
        require(POOL_MANAGER != address(0), "Set POOL_MANAGER address first");

        uint160 flags = uint160(Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG);

        vm.startBroadcast();

        // ── Mine salt for CREATE2 ─────────────────────────────
        // In production, use HookMiner from v4-periphery:
        //   (address hookAddr, bytes32 salt) = HookMiner.find(
        //       CREATE2_DEPLOYER, flags, type(SentinelPegHook).creationCode,
        //       abi.encode(IPoolManager(POOL_MANAGER))
        //   );
        //   SentinelPegHook hook = new SentinelPegHook{salt: salt}(IPoolManager(POOL_MANAGER));
        //
        // For quick testing, use deployCodeTo in a forge script context:
        SentinelPegHook hook = new SentinelPegHook(IPoolManager(POOL_MANAGER));

        vm.stopBroadcast();

        console.log("SentinelPegHook deployed at:", address(hook));
        console.log("Owner:", hook.owner());
    }
}
