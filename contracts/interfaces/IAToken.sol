// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.28;

interface IAToken {
    function mint(address user, uint256 scaledAmount) external;

    function burn(address user, uint256 scaledAmount) external;

    function balanceOf(address user) external view returns (uint256);
}
