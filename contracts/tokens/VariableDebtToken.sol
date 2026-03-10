// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.28;

import "../interfaces/ILendingPool.sol";
import "../interfaces/IVariableDebtToken.sol";
import "../libraries/WadRayMath.sol";

// import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract VariableDebtToken is Initializable, IVariableDebtToken {
    using WadRayMath for uint256;

    mapping(address => uint256) internal scaledDebts;
    uint256 internal _totalScaledDebt;

    address internal _lendingPool;
    address internal _underlyingAsset;

    string internal _debtTokenName;
    string internal _debtTokenSymbol;

    function initialize(
        address pool,
        address asset,
        string calldata debtTokenName,
        string calldata debtTokenSymbol
    ) public initializer {
        // __ERC20_init(debtTokenName, debtTokenSymbol);
        _debtTokenName = debtTokenName;
        _debtTokenSymbol = debtTokenSymbol;
        _lendingPool = pool;
        _underlyingAsset = asset;
    }

    function lendingPool() public view returns (address) {
        return _lendingPool;
    }

    function underlyingAsset() public view returns (address) {
        return _underlyingAsset;
    }

    function name() public view returns (string memory) {
        return _debtTokenName;
    }

    function symbol() public view returns (string memory) {
        return _debtTokenSymbol;
    }

    function mint(address user, uint256 scaledAmount) external {
        require(msg.sender == address(_lendingPool), "ONLY_POOL_ACCESSIBLE!");

        scaledDebts[user] += scaledAmount;
        _totalScaledDebt += scaledAmount;
        // _mint(user, scaledAmount);
    }

    function burn(address user, uint256 scaledAmount) external {
        require(msg.sender == address(_lendingPool), "ONLY_POOL_ACCESSIBLE!");

        scaledDebts[user] -= scaledAmount;
        _totalScaledDebt -= scaledAmount;
        // _burn(user, scaledAmount);
    }

    function balanceOf(address user) public view returns (uint256) {
        uint256 scaledDebt = scaledDebts[user];
        if (scaledDebt == 0) return 0;

        (, uint256 variableBorrowIndex, , , , , , , ) = ILendingPool(_lendingPool)
            .getReserves(_underlyingAsset);

        return scaledDebt.rayMul(variableBorrowIndex);
    }

    function totalSupply() public view returns (uint256) {
        if (_totalScaledDebt == 0) return 0;

        (, uint256 variableBorrowIndex, , , , , , , ) = ILendingPool(_lendingPool)
            .getReserves(_underlyingAsset);

        return _totalScaledDebt.rayMul(variableBorrowIndex);
    }
}
