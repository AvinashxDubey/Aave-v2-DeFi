import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

describe("LendingPool Lifecycle", function () {

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

    const mintAmount = hre.ethers.parseUnits("1000", 18);
    await mockToken.mint(user1.address, mintAmount);

    return {
      deployer,
      user1,
      mockToken,
      lendingPool,
      aToken,
      debtToken
    };
  }

  describe("Deposit", function () {

    it("Should mint aTokens when depositing", async function () {

      const { user1, mockToken, lendingPool, aToken } =
        await loadFixture(deployFixture);

      const depositAmount = hre.ethers.parseUnits("100", 18);

      await mockToken.connect(user1).approve(
        lendingPool.target,
        depositAmount
      );

      await lendingPool.connect(user1).deposit(
        mockToken.target,
        depositAmount
      );

      const aTokenBalance =
        await aToken.balanceOf(user1.address);

      expect(aTokenBalance).to.equal(depositAmount);

    });

  });

  describe("Borrow", function () {

    it("Should mint variable debt tokens and send asset", async function () {

      const { user1, mockToken, lendingPool, debtToken } =
        await loadFixture(deployFixture);

      const depositAmount = hre.ethers.parseUnits("200", 18);
      const borrowAmount = hre.ethers.parseUnits("50", 18);

      await mockToken.connect(user1).approve(
        lendingPool.target,
        depositAmount
      );

      await lendingPool.connect(user1).deposit(
        mockToken.target,
        depositAmount
      );

      await lendingPool.connect(user1).borrow(
        mockToken.target,
        borrowAmount
      );

      const debtBalance =
        await debtToken.balanceOf(user1.address);

      expect(debtBalance).to.equal(borrowAmount);

    });

  });

  describe("Repay", function () {

    it("Should burn debt tokens after repayment", async function () {

      const { user1, mockToken, lendingPool, debtToken } =
        await loadFixture(deployFixture);

      const depositAmount = hre.ethers.parseUnits("200", 18);
      const borrowAmount = hre.ethers.parseUnits("50", 18);

      await mockToken.connect(user1).approve(
        lendingPool.target,
        depositAmount
      );

      await lendingPool.connect(user1).deposit(
        mockToken.target,
        depositAmount
      );

      await lendingPool.connect(user1).borrow(
        mockToken.target,
        borrowAmount
      );

      await mockToken.connect(user1).approve(
        lendingPool.target,
        borrowAmount
      );

      await lendingPool.connect(user1).repay(
        mockToken.target,
        borrowAmount
      );

      const debtBalance =
        await debtToken.balanceOf(user1.address);

      expect(debtBalance).to.equal(0);

    });

  });

  describe("Withdraw", function () {

    it("Should burn aTokens and return underlying asset", async function () {

      const { user1, mockToken, lendingPool, aToken } =
        await loadFixture(deployFixture);

      const depositAmount = hre.ethers.parseUnits("100", 18);

      await mockToken.connect(user1).approve(
        lendingPool.target,
        depositAmount
      );

      await lendingPool.connect(user1).deposit(
        mockToken.target,
        depositAmount
      );

      await lendingPool.connect(user1).withdraw(
        mockToken.target,
        depositAmount
      );

      const aTokenBalance =
        await aToken.balanceOf(user1.address);

      expect(aTokenBalance).to.equal(0);

    });

  });

});