// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title ISentinelPeg — Shared types for the SentinelPeg system
/// @notice Defines depeg severity levels, events, and constants used across all SentinelPeg contracts
interface ISentinelPeg {
    // ═══════════════════════════════════════════════════════════
    //                          ENUMS
    // ═══════════════════════════════════════════════════════════

    /// @notice Depeg severity levels that drive fee tiers
    enum DepegSeverity {
        NONE,     // Peg within 0.5%  → normal fees
        MILD,     // 0.5%–2% drift   → elevated fees
        SEVERE,   // 2%–5% drift     → high fees
        CRITICAL  // >5% drift       → crisis fees
    }

    // ═══════════════════════════════════════════════════════════
    //                          EVENTS
    // ═══════════════════════════════════════════════════════════

    /// @notice Fired when depeg state changes for a stablecoin
    event DepegStateUpdated(
        address indexed stablecoin,
        DepegSeverity oldSeverity,
        DepegSeverity newSeverity,
        uint256 priceDriftBps,
        uint256 timestamp
    );

    /// @notice Fired when a fee override is applied during a swap
    event FeeOverrideApplied(bytes32 indexed poolId, DepegSeverity severity, uint24 fee);

    /// @notice Fired when the callback source is changed
    event CallbackSourceUpdated(address indexed oldSource, address indexed newSource);

    /// @notice Fired when a pool is registered for monitoring
    event PoolRegistered(bytes32 indexed poolId, address indexed stablecoin);

    // ═══════════════════════════════════════════════════════════
    //                        ERRORS
    // ═══════════════════════════════════════════════════════════

    error NotOwner();
    error NotAuthorized();
    error ZeroAddress();
    error PoolMustUseDynamicFees();
    error StalenessThresholdTooLow();
}
