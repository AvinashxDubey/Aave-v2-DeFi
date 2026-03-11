import { expect } from "chai"
import { ethers } from "hardhat"

describe("LendingPool Health Factor Tests", function () {

    let lendingPool: any
    let collateralToken: any
    let debtAssetToken: any
    let collateralAToken: any
    let borrowDebtToken: any

    let owner: any
    let user: any
    let liquidator: any

    const depositAmount = ethers.parseEther("1000")
    const borrowAmount = ethers.parseEther("500")

    beforeEach(async () => {

        [owner, user, liquidator] = await ethers.getSigners()

        const MockToken = await ethers.getContractFactory("MockToken")
        collateralToken = await MockToken.deploy("Mock WETH", "mWETH")
        debtAssetToken = await MockToken.deploy("Mock USDC", "mUSDC")

        const AToken = await ethers.getContractFactory("AToken")
        collateralAToken = await AToken.deploy()
        const debtAssetAToken = await AToken.deploy()

        const DebtToken = await ethers.getContractFactory("VariableDebtToken")
        const collateralDebtToken = await DebtToken.deploy()
        borrowDebtToken = await DebtToken.deploy()

        const LendingPool = await ethers.getContractFactory("LendingPool")
        lendingPool = await LendingPool.deploy()

        await lendingPool.initialize(
            [collateralToken.target, debtAssetToken.target],
            [collateralAToken.target, debtAssetAToken.target],
            [collateralDebtToken.target, borrowDebtToken.target]
        )

        await collateralAToken.initialize(
            lendingPool.target,
            collateralToken.target,
            "Aave Mock WETH",
            "aMWETH"
        )

        await debtAssetAToken.initialize(
            lendingPool.target,
            debtAssetToken.target,
            "Aave Mock USDC",
            "aMUSDC"
        )

        await collateralDebtToken.initialize(
            lendingPool.target,
            collateralToken.target,
            "Variable Debt Mock WETH",
            "vdMWETH"
        )

        await borrowDebtToken.initialize(
            lendingPool.target,
            debtAssetToken.target,
            "Variable Debt Mock USDC",
            "vdMUSDC"
        )

        await collateralToken.mint(user.address, ethers.parseEther("3000"))
        await debtAssetToken.mint(lendingPool.target, ethers.parseEther("3000"))
        await debtAssetToken.mint(liquidator.address, ethers.parseEther("1000"))

        await collateralToken.connect(user).approve(
            lendingPool.target,
            ethers.parseEther("2000")
        )

        await debtAssetToken.connect(user).approve(
            lendingPool.target,
            ethers.parseEther("2000")
        )

        await debtAssetToken.connect(liquidator).approve(
            lendingPool.target,
            ethers.parseEther("1000")
        )
    })

    it("User can deposit collateral", async () => {

        await lendingPool.connect(user).deposit(
            collateralToken.target,
            depositAmount
        )

        const scaledBalance =
            await collateralAToken.scaledBalanceOf(user.address)

        expect(scaledBalance).to.be.gt(0)
    })


    it("User can borrow within collateral limits", async () => {

        await lendingPool.connect(user).deposit(
            collateralToken.target,
            depositAmount
        )

        await lendingPool.connect(user).borrow(
            debtAssetToken.target,
            borrowAmount
        )

        const scaledDebt =
            await borrowDebtToken.scaledBalanceOf(user.address)

        expect(scaledDebt).to.be.gt(0)
    })


    it("Borrow should fail when already under collateral safety", async () => {

        await lendingPool.connect(user).deposit(
            collateralToken.target,
            depositAmount
        )

        await expect(
            lendingPool.connect(user).borrow(
                debtAssetToken.target,
                ethers.parseEther("820")
            )
        ).to.be.reverted
    })


    it("Repay should reduce user debt", async () => {

        await lendingPool.connect(user).deposit(
            collateralToken.target,
            depositAmount
        )

        await lendingPool.connect(user).borrow(
            debtAssetToken.target,
            borrowAmount
        )

        const debtBeforeRepay =
            await borrowDebtToken.scaledBalanceOf(user.address)

        await lendingPool.connect(user).repay(
            debtAssetToken.target,
            borrowAmount
        )

        const scaledDebt =
            await borrowDebtToken.scaledBalanceOf(user.address)

        // Index updates can leave tiny residual scaled dust due to integer rounding.
        expect(scaledDebt).to.be.lt(debtBeforeRepay)
        expect(scaledDebt).to.be.lt(debtBeforeRepay / 1_000_000n) // really small
        expect(scaledDebt).to.be.lt(ethers.parseUnits("0.0001", 18))
    })


    it("Withdraw should work after repayment", async () => {

        await lendingPool.connect(user).deposit(
            collateralToken.target,
            depositAmount
        )

        await lendingPool.connect(user).borrow(
            debtAssetToken.target,
            borrowAmount
        )

        await lendingPool.connect(user).repay(
            debtAssetToken.target,
            borrowAmount
        )

        const scaledBeforeWithdraw =
            await collateralAToken.scaledBalanceOf(user.address)

        await lendingPool.connect(user).withdraw(
            collateralToken.target,
            depositAmount
        )

        const scaledBalance =
            await collateralAToken.scaledBalanceOf(user.address)


        // Same rounding behavior applies on the aToken side after index movement.
        expect(scaledBalance).to.be.lt(scaledBeforeWithdraw)
        expect(scaledBalance).to.be.lt(scaledBeforeWithdraw / 1_000_000n)
        // remaining is insignificant dust which would stay in lending pool less 0.0001e18
        expect(scaledBalance).to.be.lt(ethers.parseUnits("0.0001", 18))
    })


    it("Health factor improves after repay", async () => {

        await lendingPool.connect(user).deposit(
            collateralToken.target,
            depositAmount
        )

        await lendingPool.connect(user).borrow(
            debtAssetToken.target,
            borrowAmount
        )

        const before =
            await lendingPool.calculateUserAccountData(user.address)

        await lendingPool.connect(user).repay(
            debtAssetToken.target,
            borrowAmount
        )

        const after =
            await lendingPool.calculateUserAccountData(user.address)

        expect(after[2]).to.be.gt(before[2]);
    })

    it("Liquidator can liquidate unhealthy position", async () => {

        await lendingPool.connect(user).deposit(
            collateralToken.target,
            ethers.parseEther("1000")
        )

        await lendingPool.connect(user).borrow(
            debtAssetToken.target,
            ethers.parseEther("790")
        )

        const debtBeforeLiquidation =
            await borrowDebtToken.scaledBalanceOf(user.address)

        // Debt index which compounds grows faster than collateral index which grows linearly.
        // Advance a year worth of time so a borderline-safe position becomes unhealthy.
        await ethers.provider.send("evm_increaseTime", [365 * 24 * 60 * 60])
        await ethers.provider.send("evm_mine", [])

        await lendingPool.connect(liquidator).liquidationCall(
            collateralToken.target,
            debtAssetToken.target,
            user.address,
            ethers.parseEther("200")
        )

        const debt =
            await borrowDebtToken.scaledBalanceOf(user.address)

        expect(debt).to.be.lt(debtBeforeLiquidation)
    })

    it("Liquidator can't liquidate healthy position", async () => {

        await lendingPool.connect(user).deposit(
            collateralToken.target,
            ethers.parseEther("1000")
        )

        await lendingPool.connect(user).borrow(
            debtAssetToken.target,
            ethers.parseEther("790")
        )

        await expect(
            lendingPool.connect(liquidator).liquidationCall(
                collateralToken.target,
                debtAssetToken.target,
                user.address,
                ethers.parseEther("200")
            )
        ).to.be.reverted;

    })

})