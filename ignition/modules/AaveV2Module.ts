import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

module.exports = buildModule("LendingPoolModule", (m) => {
  const mockToken = m.contract("MockToken", ["Mock USDC", "MTK"]);

  const lendingPoolImpl = m.contract("LendingPool");
  const lendingPoolProxy = m.contract("ERC1967Proxy", [
    lendingPoolImpl,
    "0x"
  ]);

  const lendingPool = m.contractAt("LendingPool", lendingPoolProxy);

  const aTokenImpl = m.contract("AToken", [lendingPool]);
  const aTokenProxy = m.contract("ERC1967Proxy", [
    aTokenImpl,
    "0x"
  ]);

  const aToken = m.contractAt("AToken", aTokenProxy);

  m.call(aToken, "initialize", [
    lendingPool
  ]);

  m.call(lendingPool, "initialize", [
    mockToken, 
    aToken
  ]);

  return { mockToken, aToken, lendingPool };
});