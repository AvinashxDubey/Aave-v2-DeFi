// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// 
/**
 * @dev mint tokens for testing
 * simulate real assets
 */
contract MockToken is ERC20 {
    constructor(string memory name, string memory symbol)
        ERC20(name, symbol)
    {}

    function mint(address user, uint256 amount) external {
        _mint(user, amount);
    }
}