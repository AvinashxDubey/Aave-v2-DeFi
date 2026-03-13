import fs from "fs";
import path from "path";
import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const network = await ethers.provider.getNetwork();
  const chainId = network.chainId;

  // ensure output directory
  const outDir = path.join(__dirname, "..", "ignition", "deployments", `chain-${chainId}`);
  fs.mkdirSync(outDir, { recursive: true });

  const result: Record<string, string> = {};

  // Deploy Mock tokens
  const MockToken = await ethers.getContractFactory("MockToken");
  const usdc = await MockToken.deploy("Mock USDC", "mUSDC");
  if (typeof (usdc as any).waitForDeployment === "function") await (usdc as any).waitForDeployment();
  const usdcAddr = (usdc as any).target ?? (usdc as any).address;
  console.log("Deployed mUSDC:", usdcAddr);
  result["LendingPoolModule#UsdcToken"] = usdcAddr;

  const weth = await MockToken.deploy("Mock WETH", "mWETH");
  if (typeof (weth as any).waitForDeployment === "function") await (weth as any).waitForDeployment();
  const wethAddr = (weth as any).target ?? (weth as any).address;
  console.log("Deployed mWETH:", wethAddr);
  result["LendingPoolModule#WethToken"] = wethAddr;

  // Deploy LendingPool
  const LendingPool = await ethers.getContractFactory("LendingPool");
  const lendingPool = await LendingPool.deploy();
  if (typeof (lendingPool as any).waitForDeployment === "function") await (lendingPool as any).waitForDeployment();
  const lendingPoolAddr = (lendingPool as any).target ?? (lendingPool as any).address;
  console.log("Deployed LendingPool:", lendingPoolAddr);
  result["LendingPoolModule#LendingPool"] = lendingPoolAddr;

  // Deploy implementations
  const AToken = await ethers.getContractFactory("AToken");
  const aUsdc = await AToken.deploy();
  if (typeof (aUsdc as any).waitForDeployment === "function") await (aUsdc as any).waitForDeployment();
  const aUsdcAddr = (aUsdc as any).target ?? (aUsdc as any).address;
  console.log("Deployed AUsdcImpl:", aUsdcAddr);
  result["LendingPoolModule#AUsdcImpl"] = aUsdcAddr;

  const aWeth = await AToken.deploy();
  if (typeof (aWeth as any).waitForDeployment === "function") await (aWeth as any).waitForDeployment();
  const aWethAddr = (aWeth as any).target ?? (aWeth as any).address;
  console.log("Deployed AWethImpl:", aWethAddr);
  result["LendingPoolModule#AWethImpl"] = aWethAddr;

  const VariableDebtToken = await ethers.getContractFactory("VariableDebtToken");
  const debtUsdc = await VariableDebtToken.deploy();
  if (typeof (debtUsdc as any).waitForDeployment === "function") await (debtUsdc as any).waitForDeployment();
  const debtUsdcAddr = (debtUsdc as any).target ?? (debtUsdc as any).address;
  console.log("Deployed DebtUsdcImpl:", debtUsdcAddr);
  result["LendingPoolModule#DebtUsdcImpl"] = debtUsdcAddr;

  const debtWeth = await VariableDebtToken.deploy();
  if (typeof (debtWeth as any).waitForDeployment === "function") await (debtWeth as any).waitForDeployment();
  const debtWethAddr = (debtWeth as any).target ?? (debtWeth as any).address;
  console.log("Deployed DebtWethImpl:", debtWethAddr);
  result["LendingPoolModule#DebtWethImpl"] = debtWethAddr;

  // Deploy interest rate strategy
  const InterestRateStrategy = await ethers.getContractFactory("DefaultReserveInterestRateStrategy");
  const interestRateStrategy = await InterestRateStrategy.deploy();
  if (typeof (interestRateStrategy as any).waitForDeployment === "function") await (interestRateStrategy as any).waitForDeployment();
  const interestRateStrategyAddr = (interestRateStrategy as any).target ?? (interestRateStrategy as any).address;
  console.log("Deployed InterestRateStrategy:", interestRateStrategyAddr);
  result["LendingPoolModule#InterestRateStrategy"] = interestRateStrategyAddr;

  // Initialize tokens
  await (await aUsdc.initialize(lendingPoolAddr, usdcAddr, "Aave USDC", "aUSDC")).wait();
  console.log("Initialized AUsdcImpl");
  await (await aWeth.initialize(lendingPoolAddr, wethAddr, "Aave WETH", "aWETH")).wait();
  console.log("Initialized AWethImpl");

  await (await debtUsdc.initialize(lendingPoolAddr, usdcAddr, "Variable Debt USDC", "vdUSDC")).wait();
  console.log("Initialized DebtUsdcImpl");
  await (await debtWeth.initialize(lendingPoolAddr, wethAddr, "Variable Debt WETH", "vdWETH")).wait();
  console.log("Initialized DebtWethImpl");

  // Initialize lending pool
  await (
    await lendingPool.initialize(
      [usdcAddr, wethAddr],
      [aUsdcAddr, aWethAddr],
      [debtUsdcAddr, debtWethAddr],
      interestRateStrategyAddr
    )
  ).wait();
  console.log("Initialized LendingPool");

  // write JSON
  const outPath = path.join(outDir, "deployed_addresses.json");
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log("Wrote deployed addresses to", outPath);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
