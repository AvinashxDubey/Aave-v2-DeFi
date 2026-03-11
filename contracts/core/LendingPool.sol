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
    address[] internal reservesList;
    address public poolAdmin;

    uint256 constant LIQUIDATION_BONUS = 10500;
    uint256 constant CLOSE_FACTOR = 5000;
    uint256 constant LIQUIDATION_THRESHOLD = 8000;

    modifier onlyPoolAdmin() {
        require(msg.sender == poolAdmin, "ONLY_POOL_ADMIN");
        _;
    }

    function initialize(
        address[] calldata assets,
        address[] calldata aTokens,
        address[] calldata debtTokens
    ) external initializer {
        uint256 len = assets.length;
        require(len > 0, "EMPTY_RESERVES");
        require(
            len == aTokens.length && len == debtTokens.length,
            "INVALID_RESERVE_INPUT"
        );

        poolAdmin = msg.sender;
        for (uint256 i = 0; i < len; i++) {
            _addReserve(assets[i], aTokens[i], debtTokens[i]);
        }
    }

    function addReserve(
        address asset,
        address aToken,
        address debtToken
    ) external onlyPoolAdmin {
        _addReserve(asset, aToken, debtToken);
    }

    function _addReserve(
        address asset,
        address aToken,
        address debtToken
    ) internal {
        require(
            asset != address(0) &&
                aToken != address(0) &&
                debtToken != address(0),
            "ZERO_ADDRESS"
        );

        DataTypes.ReserveData storage reserve = reserves[asset];
        require(
            reserve.aTokenAddress == address(0),
            "RESERVE_ALREADY_INITIALIZED"
        );
        require(reservesList.length < type(uint8).max, "MAX_RESERVES_REACHED");

        reserve.id = uint8(reservesList.length);
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

        reservesList.push(asset);
    }

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

    function liquidationCall(
        address collateralAsset,
        address debtAsset,
        address user,
        uint256 debtToCover
    ) external {
        DataTypes.ReserveData storage collateralReserve = reserves[
            collateralAsset
        ];

        DataTypes.ReserveData storage debtReserve = reserves[debtAsset];

        collateralReserve.updateState();
        if (debtAsset != collateralAsset) {
            debtReserve.updateState();
        }

        (, , uint256 healthFactor) = calculateUserAccountData(user);

        require(healthFactor < 1e18, "POSITION_HEALTHY");

        uint256 userScaledDebt = IVariableDebtToken(
            debtReserve.variableDebtTokenAddress
        ).scaledBalanceOf(user);

        uint256 userDebt = userScaledDebt.rayMul(
            debtReserve.variableBorrowIndex
        );

        uint256 maxLiquidatable = (userDebt * CLOSE_FACTOR) / 10000;

        uint256 actualDebtToCover = debtToCover > maxLiquidatable
            ? maxLiquidatable
            : debtToCover;

        IERC20(debtAsset).transferFrom(
            msg.sender,
            address(this),
            actualDebtToCover
        );

        uint256 scaledDebtBurn = actualDebtToCover.rayDiv(
            debtReserve.variableBorrowIndex
        );

        IVariableDebtToken(debtReserve.variableDebtTokenAddress).burn(
            user,
            scaledDebtBurn
        );

        uint256 collateralToSeize = (actualDebtToCover * LIQUIDATION_BONUS) /
            10000;

        uint256 scaledCollateral = collateralToSeize.rayDiv(
            collateralReserve.liquidityIndex
        );

        IAToken(collateralReserve.aTokenAddress).burn(user, scaledCollateral);

        IERC20(collateralAsset).transfer(msg.sender, collateralToSeize);
    }

    /**
     * -----------------------------------------------------------------------------
     * needs more research for now plug and play to see things work
     * -----------------------------------------------------------------------------
     */
    function calculateUserAccountData(
        address user
    )
        public
        view
        returns (
            uint256 totalCollateral,
            uint256 totalDebt,
            uint256 healthFactor
        )
    {
        for (uint256 i = 0; i < reservesList.length; i++) {
            address asset = reservesList[i];
            DataTypes.ReserveData storage reserve = reserves[asset];

            uint256 reserveIndex = reserve.id;

            if (usersConfig[user].isUsingAsCollateral(reserveIndex)) {
                uint256 scaledBalance = IAToken(reserve.aTokenAddress)
                    .scaledBalanceOf(user);

                uint256 actualBalance = scaledBalance.rayMul(
                    reserve.liquidityIndex
                );

                totalCollateral += actualBalance;
            }

            if (usersConfig[user].isBorrowing(reserveIndex)) {
                uint256 scaledDebt = IVariableDebtToken(
                    reserve.variableDebtTokenAddress
                ).scaledBalanceOf(user);

                uint256 actualDebt = scaledDebt.rayMul(
                    reserve.variableBorrowIndex
                );

                totalDebt += actualDebt;
            }
        }

        uint256 hf = _calculateHf(totalCollateral, totalDebt);

        return (totalCollateral, totalDebt, hf);
    }

    function _calculateHf(
        uint256 totalCollateral,
        uint256 totalDebt
    ) internal pure returns (uint256) {
        if (totalDebt == 0) {
            return type(uint256).max;
        }
        uint256 adjustedCollateral = (totalCollateral * LIQUIDATION_THRESHOLD) /
            10000;

        uint256 hf = adjustedCollateral.wadDiv(totalDebt);
        return hf;
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

        (, , uint256 hf) = calculateUserAccountData(msg.sender);

        require(hf > 1e18, "WITHDRAW_BREAKS_HEALTH_FACTOR");
        uint256 scaledAmount = amount.rayDiv(reserve.liquidityIndex);
        IAToken(reserve.aTokenAddress).burn(msg.sender, scaledAmount);

        uint256 reserveIndex = reserve.id;
        uint256 remainingBalance = IAToken(reserve.aTokenAddress).balanceOf(
            msg.sender
        );
        if (remainingBalance == 0) {
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

        (uint256 collateral, uint256 debt, ) = calculateUserAccountData(
            msg.sender
        );

        uint256 liquidationThreshold = 8000;
        uint256 adjustedCollateral = (collateral * liquidationThreshold) /
            10000;
        uint256 projectedDebt = debt + amount;
        uint256 projectedHf = adjustedCollateral.wadDiv(projectedDebt);

        require(projectedHf > 1e18, "INSUFFICIENT_COLLATERAL");

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
        uint256 remainingDebt = IVariableDebtToken(
            reserve.variableDebtTokenAddress
        ).balanceOf(msg.sender);

        if (remainingDebt == 0) {
            usersConfig[msg.sender].setBorrowing(reserveIndex, false);
        }
    }
}
