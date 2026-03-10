// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.28;

library DataTypes {
    struct ReserveData {
        //the liquidity index. Expressed in ray
        uint128 liquidityIndex;
        //variable borrow index. Expressed in ray
        uint128 variableBorrowIndex;
        //the current supply rate. Expressed in ray
        uint128 currentLiquidityRate;
        //the current variable borrow rate. Expressed in ray
        uint128 currentVariableBorrowRate;
        uint40 lastUpdateTimestamp;
        //tokens addresses
        address aTokenAddress;
        address variableDebtTokenAddress;
        uint16 ltv;
        uint16 liquidationThreshold;
        //the id of the reserve. Represents the position in the list of the active reserves
        uint8 id;
    }

    struct UserConfigurationMap {
        uint256 data;
    }
}
