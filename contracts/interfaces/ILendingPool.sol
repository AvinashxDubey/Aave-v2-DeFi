// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.28;

interface ILendingPool {
    function getReserves(address asset)
        external
        view
        returns (
            uint128 liquidityIndex,
            uint128 variableBorrowIndex,
            uint128 currentLiquidityRate,
            uint128 currentVariableBorrowRate,
            uint40 lastUpdateTimestamp,
            address aTokenAddress,
            address variableDebtTokenAddress,
            uint16 ltv,
            uint16 liquidationThreshold
        );
}