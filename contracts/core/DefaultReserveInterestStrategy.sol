// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.28;

import "../libraries/WadRayMath.sol";

contract DefaultReserveInterestRateStrategy {
    using WadRayMath for uint256;

    uint256 public constant OPTIMAL_UTILIZATION = 8e17; // 80%
    uint256 public constant BASE_BORROW_RATE = 2e16; // 2%
    uint256 public constant SLOPE1 = 4e16; // +4% up to optimal
    uint256 public constant SLOPE2 = 60e16; // +60% after optimal

    /**
     * @dev Returns borrow rate in RAY (1e27)
     */
    function calculateBorrowRate(
        uint256 totalBorrows,
        uint256 availableLiquidity
    ) external pure returns (uint256) {
        uint256 totalLiquidity = totalBorrows + availableLiquidity;
        if (totalLiquidity == 0) {
            return WadRayMath.wadToRay(BASE_BORROW_RATE);
        }

        uint256 utilization = totalBorrows.wadDiv(totalLiquidity);

        uint256 borrowRateWad;
        if (utilization <= OPTIMAL_UTILIZATION) {
            uint256 factor = utilization.wadDiv(OPTIMAL_UTILIZATION);
            borrowRateWad = BASE_BORROW_RATE + factor.wadMul(SLOPE1);
        } else {
            uint256 excess = utilization - OPTIMAL_UTILIZATION;
            uint256 normalizedExcess = excess.wadDiv(
                WadRayMath.WAD - OPTIMAL_UTILIZATION
            );
            borrowRateWad =
                BASE_BORROW_RATE +
                SLOPE1 +
                normalizedExcess.wadMul(SLOPE2);
        }

        return WadRayMath.wadToRay(borrowRateWad);
    }
}
