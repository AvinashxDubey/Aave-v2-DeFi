// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.28;

import "../types/DataTypes.sol";
import "../logic/ReserveLogic.sol";
import "../libraries/WadRayMath.sol";
import "../interfaces/IAToken.sol";
import "../interfaces/IVariableDebtToken.sol";
import "../interfaces/ILendingPool.sol";
import "../libraries/UserConfiguration.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract LendingPool is Initializable, ILendingPool {
    using WadRayMath for uint256;
    using ReserveLogic for DataTypes.ReserveData;
    using UserConfiguration for DataTypes.UserConfigurationMap;

    mapping(address => DataTypes.ReserveData) internal reserves;
    mapping(address => DataTypes.UserConfigurationMap) internal usersConfig;

    /**
     * @dev Returns selected reserve data for an asset.
     */
    function getReserves(
        address asset
    )
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
        )
    {
        DataTypes.ReserveData storage reserve = reserves[asset];
        return (
            reserve.liquidityIndex,
            reserve.variableBorrowIndex,
            reserve.currentLiquidityRate,
            reserve.currentVariableBorrowRate,
            reserve.lastUpdateTimestamp,
            reserve.aTokenAddress,
            reserve.variableDebtTokenAddress,
            reserve.ltv,
            reserve.liquidationThreshold
        );
    }

    function initialize(
        address asset,
        address aToken,
        address debtToken
    ) external {
        DataTypes.ReserveData storage reserve = reserves[asset];
        reserve.id = 1;
        reserve.liquidityIndex = uint128(1e27);
        reserve.variableBorrowIndex = uint128(1e27);

        reserve.lastUpdateTimestamp = uint40(block.timestamp);

        reserve.currentLiquidityRate = uint128(0.5e27);
        reserve.currentVariableBorrowRate = uint128(0.5e27);

        reserve.aTokenAddress = aToken;
        reserve.variableDebtTokenAddress = debtToken;

        // In Solidity DeFi protocols, percentages are often represented in basis points (bps)
        // for precision and to avoid floating-point math.
        reserve.ltv = 7500;
        reserve.liquidationThreshold = 8000;
    }

    /**
     * @dev user deposits assets to pool, then pool mint interest bearing tokens
     *
     * Deposit: 100 USDC, liquidityIndex = 1e27, scaledBalance = 100 aUSDC
     * After interest: liquidityIndex = 1.1e27, Balance becomes: 100 × 1.1 = 110 USDC
     * No state update required for users. thus, T.C. : O(1)
     *
     * we store scaledAmount instead of actual deposited value in aToken
     * scaledAmount = amount / liquidityIndex
     */
    function deposit(address asset, uint256 amount) external {
        require(amount > 0, "INVALID_AMOUNT");

        DataTypes.ReserveData storage reserve = reserves[asset];

        reserve.updateState();
        IERC20(asset).transferFrom(msg.sender, address(this), amount);

        uint256 scaledAmount = amount.rayDiv(reserve.liquidityIndex);

        IAToken(reserve.aTokenAddress).mint(msg.sender, scaledAmount);

        uint256 reserveIndex = reserve.id;
        usersConfig[msg.sender].setUsingAsCollateral(reserveIndex, true);
    }

    /**
     * @dev burn interest bearing tokens, and send underlying assets to user
     */
    function withdraw(address asset, uint256 amount) external {
        require(amount > 0, "INVALID_AMOUNT");

        DataTypes.ReserveData storage reserve = reserves[asset];

        reserve.updateState();
        uint256 scaledAmount = amount.rayDiv(reserve.liquidityIndex);
        IAToken(reserve.aTokenAddress).burn(msg.sender, scaledAmount);

        uint256 reserveIndex = reserve.id;
        if (IAToken(reserve.aTokenAddress)
            .balanceOf(msg.sender) == 0) {
            usersConfig[msg.sender].setUsingAsCollateral(reserveIndex, false);
        }

        IERC20(asset).transfer(msg.sender, amount);
    }

    /**
     * @dev
     */
    function borrow(address asset, uint256 amount) external {
        require(amount > 0, "INVALID_AMOUNT");

        DataTypes.ReserveData storage reserve = reserves[asset];

        reserve.updateState();

        uint256 scaledDebt = amount.rayDiv(reserve.variableBorrowIndex);
        IVariableDebtToken(reserve.variableDebtTokenAddress).mint(
            msg.sender,
            scaledDebt
        );

        uint256 reserveIndex = reserve.id;
        usersConfig[msg.sender].setBorrowing(reserveIndex, true);

        IERC20(asset).transfer(msg.sender, amount);
    }

    function repay(address asset, uint256 amount) external {
        require(amount > 0, "INVALID_AMOUNT");

        DataTypes.ReserveData storage reserve = reserves[asset];

        reserve.updateState();

        IERC20(asset).transferFrom(msg.sender, address(this), amount);

        uint256 scaledDebt = amount.rayDiv(reserve.variableBorrowIndex);
        IVariableDebtToken(reserve.variableDebtTokenAddress).burn(
            msg.sender,
            scaledDebt
        );

        uint256 reserveIndex = reserve.id;
        if (IVariableDebtToken(reserve.variableDebtTokenAddress)
            .balanceOf(msg.sender) == 0) {
            usersConfig[msg.sender].setBorrowing(reserveIndex, false);
        }
    }
}
