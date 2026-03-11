// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.28;

import "../interfaces/ILendingPool.sol";
import "../interfaces/IAToken.sol";
import "../libraries/WadRayMath.sol";

// import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract AToken is Initializable, IAToken {
    using WadRayMath for uint256;

    mapping(address => uint256) internal _scaledBalances;
    uint256 internal _totalScaledSupply;

    address internal _lendingPool;
    address internal _underlyingAsset;

    string internal _aTokenName;
    string internal _aTokenSymbol;

    function initialize(
        address pool,
         address asset,
         string calldata aTokenName,
         string calldata aTokenSymbol
         ) public initializer {
        // __ERC20_init(aTokenName, aTokenSymbol);
        _aTokenName = aTokenName;
        _aTokenSymbol = aTokenSymbol;
        _lendingPool = pool;
        _underlyingAsset = asset;
    }

    function lendingPool() public view returns (address) {
        return _lendingPool;
    }

    function underlyingAsset() public view returns (address) {
        return _underlyingAsset;
    }

    function mint(address user, uint256 scaledAmount) external {
        require(msg.sender == address(_lendingPool), "ONLY_POOL_ACCESSIBLE!");

        _scaledBalances[user] += scaledAmount;
        _totalScaledSupply += scaledAmount;
        // _mint(user, scaledAmount);
    }

    function burn(address user, uint256 scaledAmount) external {
        require(msg.sender == address(_lendingPool), "ONLY_POOL_ACCESSIBLE!");

        _scaledBalances[user] -= scaledAmount;
        _totalScaledSupply -= scaledAmount;
        // _burn(user, scaledAmount);
    }

    function balanceOf(address user) public view returns (uint256) {
        uint256 scaledBalance = _scaledBalances[user];
        if (scaledBalance == 0) return 0;

        (uint256 liquidityIndex, , , , , , , ,) = ILendingPool(_lendingPool)
            .getReserves(_underlyingAsset);

        return scaledBalance.rayMul(liquidityIndex);
    }

    function scaledBalanceOf(address user) external view returns (uint256) {
        return _scaledBalances[user];
    }

    function totalSupply() public view returns (uint256) {
        if (_totalScaledSupply == 0) return 0;

        (uint256 liquidityIndex, , , , , , , , ) = ILendingPool(_lendingPool)
            .getReserves(_underlyingAsset);

        return _totalScaledSupply.rayMul(liquidityIndex);
    }

}
