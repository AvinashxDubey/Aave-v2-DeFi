import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

describe("LendingPool Initialization", function () {

  async function deployFixture() {

    const [deployer, user1] = await hre.ethers.getSigners();

    const MockToken = await hre.ethers.getContractFactory("MockToken");
    const collateralToken = await MockToken.deploy("Mock WETH", "mWETH");
    const debtAssetToken = await MockToken.deploy("Mock USDC", "mUSDC");

    const LendingPool = await hre.ethers.getContractFactory("LendingPool");
    const lendingPool = await LendingPool.deploy();

    const AToken = await hre.ethers.getContractFactory("AToken");
    const collateralAToken = await AToken.deploy();
    const debtAssetAToken = await AToken.deploy();

    const VariableDebtToken = await hre.ethers.getContractFactory("VariableDebtToken");
    const collateralDebtToken = await VariableDebtToken.deploy();
    const debtAssetDebtToken = await VariableDebtToken.deploy();

    const reserveInterestRateStrategy = await hre.ethers.getContractFactory("DefaultReserveInterestRateStrategy");
    const interestStrategy = await reserveInterestRateStrategy.deploy();

    await lendingPool.initialize(
      [collateralToken.target, debtAssetToken.target],
      [collateralAToken.target, debtAssetAToken.target],
      [collateralDebtToken.target, debtAssetDebtToken.target],
      interestStrategy
    );

    await collateralAToken.initialize(
      lendingPool.target,
      collateralToken.target,
      "Aave Mock WETH",
      "aMWETH"
    );

    await debtAssetAToken.initialize(
      lendingPool.target,
      debtAssetToken.target,
      "Aave Mock USDC",
      "aMUSDC"
    );

    await collateralDebtToken.initialize(
      lendingPool.target,
      collateralToken.target,
      "Variable Debt Mock WETH",
      "vdMWETH"
    );

    await debtAssetDebtToken.initialize(
      lendingPool.target,
      debtAssetToken.target,
      "Variable Debt Mock USDC",
      "vdMUSDC"
    );

    return {
      deployer,
      user1,
      collateralToken,
      debtAssetToken,
      lendingPool,
      collateralAToken,
      collateralDebtToken,
      debtAssetDebtToken
    };
  }

  describe("Reserve Initialization", function () {

    it("Should initialize liquidity index correctly", async function () {

      const { lendingPool, collateralToken } = await loadFixture(deployFixture);

      const reserve = await lendingPool.getReserves(collateralToken.target);

      expect(reserve.liquidityIndex).to.equal(10n ** 27n);

    });

    it("Should initialize borrow index correctly", async function () {

      const { lendingPool, collateralToken } = await loadFixture(deployFixture);

      const reserve = await lendingPool.getReserves(collateralToken.target);

      expect(reserve.variableBorrowIndex).to.equal(10n ** 27n);

    });

    it("Should set correct aToken address", async function () {

      const { lendingPool, collateralToken, collateralAToken } = await loadFixture(deployFixture);

      const reserve = await lendingPool.getReserves(collateralToken.target);

      expect(reserve.aTokenAddress).to.equal(collateralAToken.target);

    });

    it("Should set correct debt token address", async function () {

      const { lendingPool, collateralToken, collateralDebtToken } = await loadFixture(deployFixture);

      const reserve = await lendingPool.getReserves(collateralToken.target);

      expect(reserve.variableDebtTokenAddress).to.equal(collateralDebtToken.target);

    });

  });

  describe("AToken Initialization", function () {

    it("Should set correct lending pool", async function () {

      const { collateralAToken, lendingPool } = await loadFixture(deployFixture);

      expect(await collateralAToken.lendingPool()).to.equal(lendingPool.target);

    });

    it("Should set correct underlying asset", async function () {

      const { collateralAToken, collateralToken } = await loadFixture(deployFixture);

      expect(await collateralAToken.underlyingAsset()).to.equal(collateralToken.target);

    });

  });

  describe("DebtToken Initialization", function () {

    it("Should set correct lending pool", async function () {

      const { debtAssetDebtToken, lendingPool } = await loadFixture(deployFixture);

      expect(await debtAssetDebtToken.lendingPool()).to.equal(lendingPool.target);

    });

    it("Should set correct underlying asset", async function () {

      const { debtAssetDebtToken, debtAssetToken } = await loadFixture(deployFixture);

      expect(await debtAssetDebtToken.underlyingAsset()).to.equal(debtAssetToken.target);

    });

  });

});