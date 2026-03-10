// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.28;

import "../libraries/WadRayMath.sol";
import "../libraries/MathUtils.sol";
import "../types/DataTypes.sol";

library ReserveLogic {
    using WadRayMath for uint256;

    function updateState(
        DataTypes.ReserveData storage reserve
    ) internal {

        uint40 lastTimestamp = reserve.lastUpdateTimestamp;

        if (lastTimestamp == uint40(block.timestamp)) {
            return;
        }

        _updateLiquidityIndex(reserve);
        _updateVariableBorrowIndex(reserve);

        reserve.lastUpdateTimestamp = uint40(block.timestamp);
    }

    function _updateLiquidityIndex(
        DataTypes.ReserveData storage reserve
    ) internal {
        uint256 rate = reserve.currentLiquidityRate;
        if(rate==0) return;

        uint256 cummulatedInterest = MathUtils.calculateLinearInterest(rate, reserve.lastUpdateTimestamp);

        uint256 newLiquitiyIndex = uint256(reserve.liquidityIndex).rayMul(cummulatedInterest);
        reserve.liquidityIndex = uint128(newLiquitiyIndex);
    }

    function _updateVariableBorrowIndex(
        DataTypes.ReserveData storage reserve
    ) internal {
        uint256 rate = reserve.currentVariableBorrowRate;
        if(rate==0) return;

        uint256 cummulatedInterest = MathUtils.calculateCompoundedInterest(rate, reserve.lastUpdateTimestamp);

        uint256 newVariableBorrowIndex = uint256(reserve.variableBorrowIndex).rayMul(cummulatedInterest);
        reserve.variableBorrowIndex = uint128(newVariableBorrowIndex);
    }
}