// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BaseHook} from "v4-periphery/src/utils/BaseHook.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "v4-core/src/types/BeforeSwapDelta.sol";
import {BalanceDelta} from "v4-core/src/types/BalanceDelta.sol";
import {LPFeeLibrary} from "v4-core/src/libraries/LPFeeLibrary.sol";
import {ModifyLiquidityParams, SwapParams} from "v4-core/src/types/PoolOperation.sol";
import {ISentinelPeg} from "./interfaces/ISentinelPeg.sol";

/// @title SentinelPegHook
/// @author SentinelPeg Team
/// @notice Uniswap v4 hook providing real-time depeg defense for stablecoin pools.
///
/// @dev Dynamically adjusts LP fees based on cross-chain depeg severity reported
///      by a Reactive Smart Contract on Reactive Network.
///
///      Fee Schedule:
///        NONE     (peg within 0.5%)   →  5 bps  (0.05%)
///        MILD     (0.5%–2% drift)     → 30 bps  (0.30%)
///        SEVERE   (2%–5% drift)       → 100 bps (1.00%)
///        CRITICAL (>5% drift)         → 500 bps (5.00%)
///        STALE    (data too old)      → 30 bps  (0.30%)
///
///      PARTNER INTEGRATIONS:
///        • Reactive Network — cross-chain depeg event monitoring via Reactive Smart
///          Contracts. The companion SentinelPegReactive.sol subscribes to Sync events
///          on origin chains and triggers updateDepegState() on this contract via
///          Reactive Network callbacks.  (see src/SentinelPegReactive.sol, lines 1–250)
///        • Unichain — this hook is designed and deployed as native stablecoin
///          infrastructure on Unichain (chain ID 130).
contract SentinelPegHook is BaseHook, ISentinelPeg {
    using PoolIdLibrary for PoolKey;
    using LPFeeLibrary for uint24;

    // ─────────────────────────────────────────────────────────
    //  Constants
    // ─────────────────────────────────────────────────────────

    uint24 public constant FEE_NONE     =   500;   // 0.05%
    uint24 public constant FEE_MILD     =  3000;   // 0.30%
    uint24 public constant FEE_SEVERE   = 10000;   // 1.00%
    uint24 public constant FEE_CRITICAL = 50000;   // 5.00%
    uint24 public constant FEE_STALE    =  3000;   // 0.30% — conservative fallback

    uint256 public constant DEFAULT_STALENESS = 3600; // 1 hour

    // ─────────────────────────────────────────────────────────
    //  Immutables & Storage
    // ─────────────────────────────────────────────────────────

    address public immutable owner;

    /// @notice Address authorised to push depeg state (Reactive callback proxy)
    address public callbackSource;

    /// @notice Seconds after which depeg data is treated as stale
    uint256 public stalenessThreshold;

    struct DepegInfo {
        DepegSeverity severity;
        uint256       driftBps;   // 100 = 1 %
        uint256       updatedAt;
    }

    /// stablecoin address → latest depeg info
    mapping(address => DepegInfo) public depegInfo;

    /// pool id → stablecoin tracked by that pool
    mapping(PoolId => address) public poolStablecoin;

    /// pool id → cumulative swap volume (in token units) during depeg events
    mapping(PoolId => uint256) public protectedVolume;

    /// Total volume protected across all pools
    uint256 public totalProtectedVolume;

    // ─────────────────────────────────────────────────────────
    //  Modifiers
    // ─────────────────────────────────────────────────────────

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyAuthorized() {
        if (msg.sender != callbackSource && msg.sender != owner) revert NotAuthorized();
        _;
    }

    // ─────────────────────────────────────────────────────────
    //  Constructor
    // ─────────────────────────────────────────────────────────

    constructor(IPoolManager _pm, address _owner) BaseHook(_pm) {
        if (_owner == address(0)) revert ZeroAddress();
        owner = _owner;
        stalenessThreshold = DEFAULT_STALENESS;
    }

    // ─────────────────────────────────────────────────────────
    //  Hook permissions
    // ─────────────────────────────────────────────────────────

    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: true,
            afterInitialize:  false,
            beforeAddLiquidity: false,
            afterAddLiquidity:  false,
            beforeRemoveLiquidity: true,   // Block LP withdrawals during CRITICAL depeg
            afterRemoveLiquidity:  false,
            beforeSwap:  true,
            afterSwap:   true,             // Track cumulative protected volume
            beforeDonate: false,
            afterDonate:  false,
            beforeSwapReturnDelta:  false,
            afterSwapReturnDelta:   false,
            afterAddLiquidityReturnDelta:    false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    // ─────────────────────────────────────────────────────────
    //  beforeInitialize — enforce dynamic-fee flag
    // ─────────────────────────────────────────────────────────

    function _beforeInitialize(address, PoolKey calldata key, uint160)
        internal pure override returns (bytes4)
    {
        if (!key.fee.isDynamicFee()) revert PoolMustUseDynamicFees();
        return this.beforeInitialize.selector;
    }

    // ─────────────────────────────────────────────────────────
    //  beforeSwap — return dynamic fee based on depeg state
    // ─────────────────────────────────────────────────────────

    function _beforeSwap(
        address,
        PoolKey calldata key,
        SwapParams calldata,
        bytes calldata
    )
        internal override returns (bytes4, BeforeSwapDelta, uint24)
    {
        uint24 fee = _resolveFee(key);

        PoolId pid = key.toId();
        address sc = poolStablecoin[pid];
        DepegSeverity sev = (sc == address(0))
            ? DepegSeverity.NONE
            : depegInfo[sc].severity;

        emit FeeOverrideApplied(PoolId.unwrap(pid), sev, fee);

        return (
            this.beforeSwap.selector,
            BeforeSwapDeltaLibrary.ZERO_DELTA,
            fee | LPFeeLibrary.OVERRIDE_FEE_FLAG
        );
    }

    // ─────────────────────────────────────────────────────────
    //  afterSwap — track cumulative protected volume
    // ─────────────────────────────────────────────────────────

    function _afterSwap(
        address,
        PoolKey calldata key,
        SwapParams calldata params,
        BalanceDelta,
        bytes calldata
    )
        internal override returns (bytes4, int128)
    {
        PoolId pid = key.toId();
        address sc = poolStablecoin[pid];

        if (sc != address(0)) {
            DepegSeverity sev = depegInfo[sc].severity;
            if (sev != DepegSeverity.NONE && !_isStale(sc)) {
                uint256 absVolume = params.amountSpecified < 0
                    ? uint256(-params.amountSpecified)
                    : uint256(params.amountSpecified);

                protectedVolume[pid] += absVolume;
                totalProtectedVolume += absVolume;

                emit SwapTracked(PoolId.unwrap(pid), uint8(sev), absVolume, protectedVolume[pid]);
            }
        }

        return (this.afterSwap.selector, 0);
    }

    // ─────────────────────────────────────────────────────────
    //  beforeRemoveLiquidity — block withdrawals during CRITICAL depeg
    // ─────────────────────────────────────────────────────────

    function _beforeRemoveLiquidity(
        address sender,
        PoolKey calldata key,
        ModifyLiquidityParams calldata,
        bytes calldata
    )
        internal override returns (bytes4)
    {
        PoolId pid = key.toId();
        address sc = poolStablecoin[pid];

        if (sc != address(0)) {
            DepegSeverity sev = depegInfo[sc].severity;
            if (sev == DepegSeverity.CRITICAL && !_isStale(sc)) {
                emit LiquidityRemovalBlocked(PoolId.unwrap(pid), sender, uint8(sev));
                revert LiquidityRemovalBlockedDuringDepeg();
            }
        }

        return this.beforeRemoveLiquidity.selector;
    }

    // ─────────────────────────────────────────────────────────
    //  State-update entry points
    // ─────────────────────────────────────────────────────────

    /// @notice Called by Reactive Network callback proxy.
    /// @dev First parameter (reactiveId) is auto-injected by the Reactive Network
    ///      transport layer and equals the ReactVM deployer address.
    function updateDepegState(
        address /* reactiveId */,
        address stablecoin,
        uint8   severity,
        uint256 driftBps
    ) external onlyAuthorized {
        _setDepegState(stablecoin, DepegSeverity(severity), driftBps);
    }

    /// @notice Owner-only helper for local testing / manual override.
    function setDepegState(
        address stablecoin,
        DepegSeverity severity,
        uint256 driftBps
    ) external onlyOwner {
        _setDepegState(stablecoin, severity, driftBps);
    }

    // ─────────────────────────────────────────────────────────
    //  Admin
    // ─────────────────────────────────────────────────────────

    function registerPool(PoolKey calldata key, address stablecoin) external onlyOwner {
        if (stablecoin == address(0)) revert ZeroAddress();
        PoolId pid = key.toId();
        poolStablecoin[pid] = stablecoin;
        emit PoolRegistered(PoolId.unwrap(pid), stablecoin);
    }

    function setCallbackSource(address src) external onlyOwner {
        emit CallbackSourceUpdated(callbackSource, src);
        callbackSource = src;
    }

    function setStalenessThreshold(uint256 t) external onlyOwner {
        if (t < 60) revert StalenessThresholdTooLow();
        stalenessThreshold = t;
    }

    // ─────────────────────────────────────────────────────────
    //  View helpers
    // ─────────────────────────────────────────────────────────

    function getCurrentFee(address stablecoin) external view returns (uint24) {
        if (_isStale(stablecoin)) return FEE_STALE;
        return _feeForSeverity(depegInfo[stablecoin].severity);
    }

    function getDepegState(address stablecoin)
        external view
        returns (DepegSeverity severity, uint256 driftBps, uint256 updatedAt, bool isStale)
    {
        DepegInfo storage d = depegInfo[stablecoin];
        return (d.severity, d.driftBps, d.updatedAt, _isStale(stablecoin));
    }

    function getProtectedVolume(PoolKey calldata key) external view returns (uint256) {
        return protectedVolume[key.toId()];
    }

    function isLiquidityLocked(address stablecoin) external view returns (bool) {
        if (stablecoin == address(0)) return false;
        return depegInfo[stablecoin].severity == DepegSeverity.CRITICAL && !_isStale(stablecoin);
    }

    // ─────────────────────────────────────────────────────────
    //  Internal helpers
    // ─────────────────────────────────────────────────────────

    function _setDepegState(address stablecoin, DepegSeverity severity, uint256 driftBps) internal {
        if (stablecoin == address(0)) revert ZeroAddress();

        DepegSeverity old = depegInfo[stablecoin].severity;
        depegInfo[stablecoin] = DepegInfo({
            severity:  severity,
            driftBps:  driftBps,
            updatedAt: block.timestamp
        });

        emit DepegStateUpdated(stablecoin, old, severity, driftBps, block.timestamp);
    }

    function _resolveFee(PoolKey calldata key) internal view returns (uint24) {
        address sc = poolStablecoin[key.toId()];
        if (sc == address(0)) return FEE_NONE;       // unregistered pool
        if (_isStale(sc))     return FEE_STALE;       // stale data
        return _feeForSeverity(depegInfo[sc].severity);
    }

    function _feeForSeverity(DepegSeverity s) internal pure returns (uint24) {
        if (s == DepegSeverity.MILD)     return FEE_MILD;
        if (s == DepegSeverity.SEVERE)   return FEE_SEVERE;
        if (s == DepegSeverity.CRITICAL) return FEE_CRITICAL;
        return FEE_NONE;
    }

    /// @dev Data is stale when it has been set at least once and exceeds the threshold.
    function _isStale(address stablecoin) internal view returns (bool) {
        uint256 t = depegInfo[stablecoin].updatedAt;
        if (t == 0) return false;                     // never set → use default NONE
        return block.timestamp - t > stalenessThreshold;
    }
}
