import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

describe("LendingPool Lifecycle", function () {

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
    const borrowDebtToken = await VariableDebtToken.deploy();

    await lendingPool.initialize(
      [collateralToken.target, debtAssetToken.target],
      [collateralAToken.target, debtAssetAToken.target],
      [collateralDebtToken.target, borrowDebtToken.target]
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

    await borrowDebtToken.initialize(
      lendingPool.target,
      debtAssetToken.target,
      "Variable Debt Mock USDC",
      "vdMUSDC"
    );

    const collateralMintAmount = hre.ethers.parseUnits("1000", 18);
    await collateralToken.mint(user1.address, collateralMintAmount);

    // Seed borrow-asset liquidity so users can borrow USDC against WETH collateral.
    const debtAssetLiquidity = hre.ethers.parseUnits("1000", 18);
    await debtAssetToken.mint(lendingPool.target, debtAssetLiquidity);

    return {
      deployer,
      user1,
      collateralToken,
      debtAssetToken,
      lendingPool,
      collateralAToken,
      borrowDebtToken
    };
  }

  describe("Deposit", function () {

    it("Should mint aTokens when depositing", async function () {

      const { user1, collateralToken, lendingPool, collateralAToken } =
        await loadFixture(deployFixture);

      const depositAmount = hre.ethers.parseUnits("100", 18);

      await collateralToken.connect(user1).approve(
        lendingPool.target,
        depositAmount
      );

      await lendingPool.connect(user1).deposit(
        collateralToken.target,
        depositAmount
      );

      const aTokenBalance =
        await collateralAToken.balanceOf(user1.address);

      expect(aTokenBalance).to.equal(depositAmount);

    });

  });

  describe("Borrow", function () {

    it("Should mint variable debt tokens and send asset", async function () {

      const { user1, collateralToken, debtAssetToken, lendingPool, borrowDebtToken } =
        await loadFixture(deployFixture);

      const depositAmount = hre.ethers.parseUnits("200", 18);
      const borrowAmount = hre.ethers.parseUnits("50", 18);

      await collateralToken.connect(user1).approve(
        lendingPool.target,
        depositAmount
      );

      await lendingPool.connect(user1).deposit(
        collateralToken.target,
        depositAmount
      );

      await lendingPool.connect(user1).borrow(
        debtAssetToken.target,
        borrowAmount
      );

      const debtBalance =
        await borrowDebtToken.balanceOf(user1.address);

      expect(debtBalance).to.equal(borrowAmount);

    });

  });

  describe("Repay", function () {

    it("Should burn debt tokens after repayment", async function () {

      const { user1, collateralToken, debtAssetToken, lendingPool, borrowDebtToken } =
        await loadFixture(deployFixture);

      const depositAmount = hre.ethers.parseUnits("200", 18);
      const borrowAmount = hre.ethers.parseUnits("50", 18);

      await collateralToken.connect(user1).approve(
        lendingPool.target,
        depositAmount
      );

      await lendingPool.connect(user1).deposit(
        collateralToken.target,
        depositAmount
      );

      await lendingPool.connect(user1).borrow(
        debtAssetToken.target,
        borrowAmount
      );

      await debtAssetToken.connect(user1).approve(
        lendingPool.target,
        borrowAmount
      );

      const debtBeforeRepay = await borrowDebtToken.balanceOf(user1.address);

      await lendingPool.connect(user1).repay(
        debtAssetToken.target,
        borrowAmount
      );

      const debtBalance =
        await borrowDebtToken.balanceOf(user1.address);

      // Small residual dust can remain due to index updates and integer rounding.
      expect(debtBalance).to.be.lt(debtBeforeRepay);
      expect(debtBalance).to.be.lt(hre.ethers.parseUnits("0.0001", 18));

    });

  });

  describe("Withdraw", function () {

    it("Should burn aTokens and return underlying asset", async function () {

      const { user1, collateralToken, debtAssetToken, lendingPool, collateralAToken } =
        await loadFixture(deployFixture);

      const depositAmount = hre.ethers.parseUnits("100", 18);

      await collateralToken.connect(user1).approve(
        lendingPool.target,
        depositAmount
      );

      await lendingPool.connect(user1).deposit(
        collateralToken.target,
        depositAmount
      );

      const aTokenBeforeWithdraw =
        await collateralAToken.balanceOf(user1.address);

      await lendingPool.connect(user1).borrow(
        debtAssetToken.target,
        hre.ethers.parseUnits("50", 18)
      );

      await debtAssetToken.connect(user1).approve(
        lendingPool.target,
        hre.ethers.parseUnits("50", 18)
      );

      await lendingPool.connect(user1).repay(
        debtAssetToken.target,
        hre.ethers.parseUnits("50", 18)
      );

      await lendingPool.connect(user1).withdraw(
        collateralToken.target,
        depositAmount
      );

      const aTokenBalance =
        await collateralAToken.balanceOf(user1.address);

      // Same index rounding can leave tiny aToken dust after full-notional withdraw.
      expect(aTokenBalance).to.be.lt(aTokenBeforeWithdraw);
      expect(aTokenBalance).to.be.lt(hre.ethers.parseUnits("0.0001", 18));

    });

  });

});