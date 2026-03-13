// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {HookMiner} from "v4-periphery/src/utils/HookMiner.sol";
import {SentinelPegHook} from "../src/SentinelPegHook.sol";

/// @title DeployHook
/// @notice Deploys SentinelPegHook to Unichain with the correct address prefix.
///
/// @dev Uniswap v4 hooks must be deployed at addresses whose leading bits encode the
///      enabled hook permissions. We use CREATE2 via the deterministic deployer to mine
///      an address that starts with the correct flag bits (BEFORE_INITIALIZE | BEFORE_SWAP).
///
///      Usage:
///        source .env
///        forge script script/DeployHook.s.sol \
///          --rpc-url $UNICHAIN_RPC_URL \
///          --private-key $UNICHAIN_PRIVATE_KEY \
///          --broadcast
contract DeployHook is Script {
    /// @dev Standard CREATE2 deployer proxy used by forge on all chains.
    address constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    function run() external {
        // ── Read config from environment ─────────────────────────
        address poolManager = vm.envAddress("POOL_MANAGER_ADDRESS");
        address deployer    = vm.envAddress("DEPLOYER_ADDRESS");
        require(poolManager != address(0), "POOL_MANAGER_ADDRESS not set in .env");
        require(deployer != address(0), "DEPLOYER_ADDRESS not set in .env");

        // ── Hook permission flags ────────────────────────────────
        uint160 flags = uint160(
            Hooks.BEFORE_INITIALIZE_FLAG
            | Hooks.BEFORE_SWAP_FLAG
            | Hooks.AFTER_SWAP_FLAG
            | Hooks.BEFORE_REMOVE_LIQUIDITY_FLAG
        );

        // ── Mine a CREATE2 salt for the correct hook address ─────
        bytes memory constructorArgs = abi.encode(IPoolManager(poolManager), deployer);

        console.log("Mining CREATE2 salt for hook address...");
        console.log("  Owner will be:", deployer);
        (address hookAddress, bytes32 salt) = HookMiner.find(
            CREATE2_DEPLOYER,
            flags,
            type(SentinelPegHook).creationCode,
            constructorArgs
        );
        console.log("Found hook address:", hookAddress);
        console.log("Salt:", vm.toString(salt));

        // ── Deploy ───────────────────────────────────────────────
        vm.startBroadcast();

        SentinelPegHook hook = new SentinelPegHook{salt: salt}(
            IPoolManager(poolManager),
            deployer
        );

        vm.stopBroadcast();

        // ── Verify ───────────────────────────────────────────────
        require(address(hook) == hookAddress, "Hook address mismatch - salt is stale");

        console.log("");
        console.log("=== SentinelPeg Hook Deployed ===");
        console.log("  Hook address:   ", address(hook));
        console.log("  Owner:          ", hook.owner());
        console.log("  PoolManager:    ", poolManager);
        console.log("");
        console.log("Next steps:");
        console.log("  1. Set HOOK_ADDRESS=%s in .env", vm.toString(address(hook)));
        console.log("  2. Deploy reactive contract: forge script script/DeployReactive.s.sol --broadcast");
        console.log("  3. Register pool & set callback source (see README)");
    }
}
