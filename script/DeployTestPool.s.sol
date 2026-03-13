// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {ModifyLiquidityParams, SwapParams} from "v4-core/src/types/PoolOperation.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {LPFeeLibrary} from "v4-core/src/libraries/LPFeeLibrary.sol";
import {PoolSwapTest} from "v4-core/src/test/PoolSwapTest.sol";
import {PoolModifyLiquidityTest} from "v4-core/src/test/PoolModifyLiquidityTest.sol";
import {MockERC20} from "solmate/src/test/utils/mocks/MockERC20.sol";
import {TickMath} from "v4-core/src/libraries/TickMath.sol";

interface ISentinelPegHook {
    function registerPool(PoolKey calldata key, address stablecoin) external;
    function setCallbackSource(address src) external;
}

/// @title DeployTestPool
/// @notice Deploys full swap infrastructure for SentinelPeg demo:
///         test tokens, routers, pool with hook, initial liquidity
contract DeployTestPool is Script {
    // 1:1 starting price
    uint160 constant SQRT_PRICE_1_1 = 79228162514264337593543950336;

    function run() external {
        address poolManager = vm.envAddress("POOL_MANAGER_ADDRESS");
        address hookAddress = vm.envAddress("HOOK_ADDRESS");

        vm.startBroadcast();

        // ── 1. Deploy test tokens ──
        MockERC20 tokenA = new MockERC20("SentinelPeg USD", "spUSD", 18);
        MockERC20 tokenB = new MockERC20("SentinelPeg ETH", "spETH", 18);

        // Sort: currency0 < currency1
        (MockERC20 token0, MockERC20 token1) = address(tokenA) < address(tokenB)
            ? (tokenA, tokenB)
            : (tokenB, tokenA);

        console.log("--- Deployed Tokens ---");
        console.log("TOKEN0 (spUSD or spETH):", address(token0));
        console.log("TOKEN1 (spUSD or spETH):", address(token1));

        // ── 2. Deploy routers ──
        PoolSwapTest swapRouter = new PoolSwapTest(IPoolManager(poolManager));
        PoolModifyLiquidityTest liqRouter = new PoolModifyLiquidityTest(IPoolManager(poolManager));

        console.log("SWAP_ROUTER:", address(swapRouter));
        console.log("LIQUIDITY_ROUTER:", address(liqRouter));

        // ── 3. Build PoolKey with dynamic fee + our hook ──
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(address(token0)),
            currency1: Currency.wrap(address(token1)),
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: int24(60),
            hooks: IHooks(hookAddress)
        });

        // ── 4. Initialize pool ──
        IPoolManager(poolManager).initialize(key, SQRT_PRICE_1_1);
        console.log("Pool initialized with DYNAMIC_FEE_FLAG");

        // ── 5. Register pool with hook ──
        // Use token0 as the "stablecoin" the hook tracks
        ISentinelPegHook(hookAddress).registerPool(key, address(token0));
        console.log("Pool registered with hook, stablecoin:", address(token0));

        // ── 6. Mint tokens ──
        uint256 mintAmount = 1_000_000 ether;
        token0.mint(msg.sender, mintAmount);
        token1.mint(msg.sender, mintAmount);

        // ── 7. Approve routers ──
        token0.approve(address(swapRouter), type(uint256).max);
        token1.approve(address(swapRouter), type(uint256).max);
        token0.approve(address(liqRouter), type(uint256).max);
        token1.approve(address(liqRouter), type(uint256).max);

        // ── 8. Add initial liquidity ──
        liqRouter.modifyLiquidity(
            key,
            ModifyLiquidityParams({
                tickLower: -6000,
                tickUpper: 6000,
                liquidityDelta: 10_000 ether,
                salt: bytes32(0)
            }),
            ""
        );
        console.log("Initial liquidity added (-6000 to 6000, 10000 ether)");

        // ── 9. Test swap to verify hook works ──
        PoolSwapTest.TestSettings memory settings = PoolSwapTest.TestSettings({
            takeClaims: false,
            settleUsingBurn: false
        });
        swapRouter.swap(
            key,
            SwapParams({
                zeroForOne: true,
                amountSpecified: -0.001 ether,
                sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1
            }),
            settings,
            ""
        );
        console.log("Test swap succeeded - hook is working!");

        vm.stopBroadcast();

        // ── Output for .env / frontend ──
        console.log("");
        console.log("=== ADD TO .env ===");
        console.log("TOKEN0_ADDRESS=", address(token0));
        console.log("TOKEN1_ADDRESS=", address(token1));
        console.log("SWAP_ROUTER_ADDRESS=", address(swapRouter));
        console.log("LIQUIDITY_ROUTER_ADDRESS=", address(liqRouter));
        console.log("STABLECOIN_ON_UNICHAIN=", address(token0));
        console.log("");
        console.log("=== UPDATE frontend/src/lib/constants.ts ===");
        console.log("STABLECOIN should be:", address(token0));
    }
}
