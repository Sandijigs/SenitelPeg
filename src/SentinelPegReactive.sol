// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ISentinelPeg} from "./interfaces/ISentinelPeg.sol";

/// @title SentinelPegReactive
/// @author SentinelPeg Team
/// @notice Reactive Smart Contract deployed on Reactive Network.
///
/// @dev Subscribes to Uniswap V2 Sync events on an origin chain (e.g. Ethereum).
///      When reserves change, it calculates how far the stablecoin price has drifted
///      from its peg and — if the severity level has changed — emits a Callback that
///      Reactive Network relays to the SentinelPeg hook on the destination chain
///      (Unichain).
///
///      PARTNER INTEGRATION — REACTIVE NETWORK:
///        This contract uses Reactive Network's event subscription system to monitor
///        on-chain events across EVM chains without any off-chain infrastructure.
///        It implements IReactive.react() and uses the Callback event to trigger
///        cross-chain transactions.  (see https://dev.reactive.network/reactive-contracts)
///
///      Flow:  Origin Sync event  →  ReactVM react()  →  Callback event
///             →  Reactive Network relays  →  SentinelPegHook.updateDepegState()
contract SentinelPegReactive {

    // ─────────────────────────────────────────────────────────
    //  Reactive Network primitives
    // ─────────────────────────────────────────────────────────

    /// @dev System contract on the Reactive Network (not in ReactVM)
    address private constant SERVICE_ADDR = 0x0000000000000000000000000000000000fffFfF;

    /// @dev Magic value: "ignore this filter field"
    uint256 private constant REACTIVE_IGNORE =
        0xa65f96fc951c35ead38878e0f0b7a3c744a6f5ccc1476b313353ce31712313ad;

    /// @dev keccak256("Sync(uint112,uint112)")
    uint256 public constant SYNC_TOPIC_0 =
        0x1c411e9a96e071241c2f21f7726b17ae89e3cab4c78be50e062b03a9fffbbad1;

    uint64 private constant CALLBACK_GAS_LIMIT = 300_000;

    // ─────────────────────────────────────────────────────────
    //  Depeg thresholds  (basis points — 100 = 1 %)
    // ─────────────────────────────────────────────────────────

    uint256 public constant THRESHOLD_MILD     =  50;   // 0.50 %
    uint256 public constant THRESHOLD_SEVERE   = 200;   // 2.00 %
    uint256 public constant THRESHOLD_CRITICAL = 500;   // 5.00 %

    /// @dev How many consecutive readings at a new severity before emitting callback.
    ///      CRITICAL always fires immediately.
    uint256 public constant CONFIRMATION_COUNT = 2;

    // ─────────────────────────────────────────────────────────
    //  Events (Reactive Network transport)
    // ─────────────────────────────────────────────────────────

    /// @notice Reactive Network picks this up and submits a tx on the destination chain
    event Callback(
        uint256 indexed chain_id,
        address indexed _contract,
        uint64  indexed gas_limit,
        bytes payload
    );

    /// @notice Debugging / monitoring event
    event DepegDetected(
        uint256 reserve0,
        uint256 reserve1,
        uint256 driftBps,
        ISentinelPeg.DepegSeverity severity
    );

    // ─────────────────────────────────────────────────────────
    //  LogRecord (matches Reactive IReactive interface)
    // ─────────────────────────────────────────────────────────

    struct LogRecord {
        uint256 chain_id;
        address _contract;
        uint256 topic_0;
        uint256 topic_1;
        uint256 topic_2;
        uint256 topic_3;
        bytes   data;
        uint256 block_number;
        uint256 op_code;
        uint256 block_hash;
        uint256 tx_hash;
        uint256 log_index;
    }

    // ─────────────────────────────────────────────────────────
    //  Storage
    // ─────────────────────────────────────────────────────────

    bool    private vm;                  // true inside ReactVM
    uint256 public  originChainId;       // e.g. 1 for Ethereum
    uint256 public  destinationChainId;  // 130 for Unichain
    address public  monitoredPool;       // Uniswap V2 pool on origin
    address public  callbackTarget;      // SentinelPegHook on destination
    address public  stablecoinAddress;   // stablecoin on destination
    bool    public  stablecoinIsToken0;  // position in the pair
    uint256 public  referenceEthPrice;   // expected ETH price in whole stablecoin units (e.g. 3000 for $3000)

    ISentinelPeg.DepegSeverity public lastSeverity;
    ISentinelPeg.DepegSeverity public pendingSeverity;
    uint256 public consecutiveReadings;

    // ─────────────────────────────────────────────────────────
    //  Modifiers
    // ─────────────────────────────────────────────────────────

    modifier vmOnly() {
        require(vm, "NOT_IN_REACTVM");
        _;
    }

    // ─────────────────────────────────────────────────────────
    //  Constructor
    // ─────────────────────────────────────────────────────────

    /// @param _originChainId       Chain with the monitored pool (1 = Ethereum)
    /// @param _destinationChainId  Chain with the hook (130 = Unichain)
    /// @param _monitoredPool       Uniswap V2 pair address on origin chain
    /// @param _callbackTarget      SentinelPegHook address on destination chain
    /// @param _stablecoin          Stablecoin address (used in callback payload)
    /// @param _stablecoinIsToken0  Is the stablecoin token0 in the pair?
    /// @param _refEthPrice         Reference ETH price in whole stablecoin units (e.g. 3000 for $3000/ETH)
    constructor(
        uint256 _originChainId,
        uint256 _destinationChainId,
        address _monitoredPool,
        address _callbackTarget,
        address _stablecoin,
        bool    _stablecoinIsToken0,
        uint256 _refEthPrice
    ) payable {
        originChainId      = _originChainId;
        destinationChainId = _destinationChainId;
        monitoredPool      = _monitoredPool;
        callbackTarget     = _callbackTarget;
        stablecoinAddress  = _stablecoin;
        stablecoinIsToken0 = _stablecoinIsToken0;
        referenceEthPrice  = _refEthPrice;
        lastSeverity       = ISentinelPeg.DepegSeverity.NONE;

        // ── Detect environment ───────────────────────────────
        // On the Reactive Network the system contract exists;
        // inside ReactVM it does not.
        uint256 size;
        assembly { size := extcodesize(0x0000000000000000000000000000000000fffFfF) }

        if (size > 0) {
            // We are on the Reactive Network  → set up subscriptions
            vm = false;
            (bool ok,) = SERVICE_ADDR.call(
                abi.encodeWithSignature(
                    "subscribe(uint256,address,uint256,uint256,uint256,uint256)",
                    _originChainId,
                    _monitoredPool,
                    SYNC_TOPIC_0,
                    REACTIVE_IGNORE,
                    REACTIVE_IGNORE,
                    REACTIVE_IGNORE
                )
            );
            require(ok, "SUBSCRIBE_FAILED");
        } else {
            // We are inside ReactVM  → event processing mode
            vm = true;
        }
    }

    // ─────────────────────────────────────────────────────────
    //  react()  —  called by ReactVM when Sync event arrives
    // ─────────────────────────────────────────────────────────

    function react(LogRecord calldata log) external vmOnly {
        require(log.topic_0 == SYNC_TOPIC_0, "UNEXPECTED_EVENT");

        // Decode reserves from Sync(uint112, uint112)
        (uint112 reserve0, uint112 reserve1) = abi.decode(log.data, (uint112, uint112));

        uint256 driftBps = _calcDriftBps(reserve0, reserve1);
        ISentinelPeg.DepegSeverity severity = _classify(driftBps);

        emit DepegDetected(reserve0, reserve1, driftBps, severity);

        // ── Confirmation logic ───────────────────────────────
        if (severity == pendingSeverity) {
            consecutiveReadings++;
        } else {
            pendingSeverity      = severity;
            consecutiveReadings  = 1;
        }

        bool fire = false;
        if (severity != lastSeverity) {
            if (severity == ISentinelPeg.DepegSeverity.CRITICAL) {
                fire = true;                       // CRITICAL → immediate
            } else if (consecutiveReadings >= CONFIRMATION_COUNT) {
                fire = true;                       // confirmed by N readings
            }
        }

        if (fire) {
            lastSeverity        = severity;
            consecutiveReadings = 0;

            // Encode payload for SentinelPegHook.updateDepegState(address,address,uint8,uint256)
            // First arg (address) is auto-replaced by Reactive Network with ReactVM deployer.
            bytes memory payload = abi.encodeWithSignature(
                "updateDepegState(address,address,uint8,uint256)",
                address(0),           // ← replaced by ReactVM ID
                stablecoinAddress,
                uint8(severity),
                driftBps
            );

            emit Callback(destinationChainId, callbackTarget, CALLBACK_GAS_LIMIT, payload);
        }
    }

    // ─────────────────────────────────────────────────────────
    //  Price drift calculation
    // ─────────────────────────────────────────────────────────

    /// @dev Calculates the percentage drift (in bps) of the implied ETH price
    ///      from the reference price, using pool reserves.
    ///
    ///      For a USDC (6 dec) / WETH (18 dec) pair:
    ///        impliedPrice = stablecoinReserve × 10^12 / ethReserve
    ///      The 10^12 factor normalises the decimal gap (18 − 6 = 12), giving
    ///      the price of 1 ETH in whole stablecoin units (e.g. 3000 = $3000).
    function _calcDriftBps(uint112 r0, uint112 r1) internal view returns (uint256) {
        if (r0 == 0 || r1 == 0 || referenceEthPrice == 0) return 0;

        uint256 stableRes;
        uint256 ethRes;
        if (stablecoinIsToken0) {
            stableRes = uint256(r0);
            ethRes    = uint256(r1);
        } else {
            stableRes = uint256(r1);
            ethRes    = uint256(r0);
        }

        // impliedPrice has same unit as referenceEthPrice (whole stablecoin units per 1 ETH)
        uint256 impliedPrice = (stableRes * 1e12) / ethRes;

        uint256 diff = impliedPrice > referenceEthPrice
            ? impliedPrice - referenceEthPrice
            : referenceEthPrice - impliedPrice;

        return (diff * 10_000) / referenceEthPrice;
    }

    function _classify(uint256 driftBps) internal pure returns (ISentinelPeg.DepegSeverity) {
        if (driftBps >= THRESHOLD_CRITICAL) return ISentinelPeg.DepegSeverity.CRITICAL;
        if (driftBps >= THRESHOLD_SEVERE)   return ISentinelPeg.DepegSeverity.SEVERE;
        if (driftBps >= THRESHOLD_MILD)     return ISentinelPeg.DepegSeverity.MILD;
        return ISentinelPeg.DepegSeverity.NONE;
    }

    // ─────────────────────────────────────────────────────────
    //  Admin  (callable on Reactive Network instance only)
    // ─────────────────────────────────────────────────────────

    function updateReferencePrice(uint256 p) external {
        require(!vm, "ONLY_ON_RN");
        referenceEthPrice = p;
    }

    receive() external payable {}
}
