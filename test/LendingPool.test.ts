import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

describe("LendingPool Initialization", function () {

  async function deployFixture() {

    const [deployer, user1] = await hre.ethers.getSigners();

    const MockToken = await hre.ethers.getContractFactory("MockToken");
    const mockToken = await MockToken.deploy("Mock USDC", "mUSDC");

    const LendingPool = await hre.ethers.getContractFactory("LendingPool");
    const lendingPool = await LendingPool.deploy();

    const AToken = await hre.ethers.getContractFactory("AToken");
    const aToken = await AToken.deploy();

    const VariableDebtToken = await hre.ethers.getContractFactory("VariableDebtToken");
    const debtToken = await VariableDebtToken.deploy();

    await lendingPool.initialize(
      mockToken.target,
      aToken.target,
      debtToken.target
    );

    await aToken.initialize(
      lendingPool.target,
      mockToken.target,
      "Aave Mock USDC",
      "aMUSDC"
    );

    await debtToken.initialize(
      lendingPool.target,
      mockToken.target,
      "Variable Debt Mock USDC",
      "vdMUSDC"
    );

    return {
      deployer,
      user1,
      mockToken,
      lendingPool,
      aToken,
      debtToken
    };
  }

  describe("Reserve Initialization", function () {

    it("Should initialize liquidity index correctly", async function () {

      const { lendingPool, mockToken } = await loadFixture(deployFixture);

      const reserve = await lendingPool.reserves(mockToken.target);

      expect(reserve.liquidityIndex).to.equal(10n ** 27n);

    });

    it("Should initialize borrow index correctly", async function () {

      const { lendingPool, mockToken } = await loadFixture(deployFixture);

      const reserve = await lendingPool.reserves(mockToken.target);

      expect(reserve.variableBorrowIndex).to.equal(10n ** 27n);

    });

    it("Should set correct aToken address", async function () {

      const { lendingPool, mockToken, aToken } = await loadFixture(deployFixture);

      const reserve = await lendingPool.reserves(mockToken.target);

      expect(reserve.aTokenAddress).to.equal(aToken.target);

    });

    it("Should set correct debt token address", async function () {

      const { lendingPool, mockToken, debtToken } = await loadFixture(deployFixture);

      const reserve = await lendingPool.reserves(mockToken.target);

      expect(reserve.variableDebtTokenAddress).to.equal(debtToken.target);

    });

  });

  describe("AToken Initialization", function () {

    it("Should set correct lending pool", async function () {

      const { aToken, lendingPool } = await loadFixture(deployFixture);

      expect(await aToken.lendingPool()).to.equal(lendingPool.target);

    });

    it("Should set correct underlying asset", async function () {

      const { aToken, mockToken } = await loadFixture(deployFixture);

      expect(await aToken.underlyingAsset()).to.equal(mockToken.target);

    });

  });

  describe("DebtToken Initialization", function () {

    it("Should set correct lending pool", async function () {

      const { debtToken, lendingPool } = await loadFixture(deployFixture);

      expect(await debtToken.lendingPool()).to.equal(lendingPool.target);

    });

    it("Should set correct underlying asset", async function () {

      const { debtToken, mockToken } = await loadFixture(deployFixture);

      expect(await debtToken.underlyingAsset()).to.equal(mockToken.target);

    });

  });

});