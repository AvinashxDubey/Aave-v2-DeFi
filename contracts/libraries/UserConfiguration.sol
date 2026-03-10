// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../types/DataTypes.sol";

library UserConfiguration {

    function setBorrowing(
        DataTypes.UserConfigurationMap storage self,
        uint256 reserveIndex,
        bool borrowing
    ) internal {

        uint256 bit = 1 << (reserveIndex * 2);

        if (borrowing) {
            self.data |= bit;
        } else {
            self.data &= ~bit;
        }
    }

    function setUsingAsCollateral(
        DataTypes.UserConfigurationMap storage self,
        uint256 reserveIndex,
        bool usingAsCollateral
    ) internal {

        uint256 bit = 1 << (reserveIndex * 2 + 1);

        if (usingAsCollateral) {
            self.data |= bit;
        } else {
            self.data &= ~bit;
        }
    }

    function isBorrowing(
        DataTypes.UserConfigurationMap storage self,
        uint256 reserveIndex
    ) internal view returns (bool) {

        uint256 bit = 1 << (reserveIndex * 2);
        return (self.data & bit) != 0;
    }

    function isUsingAsCollateral(
        DataTypes.UserConfigurationMap storage self,
        uint256 reserveIndex
    ) internal view returns (bool) {

        uint256 bit = 1 << (reserveIndex * 2 + 1);
        return (self.data & bit) != 0;
    }
}