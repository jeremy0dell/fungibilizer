const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // 1. Deploy Fungibilizer (ERC-721 catalyst token)
  const Fungibilizer = await hre.ethers.getContractFactory("Fungibilizer");
  const fungibilizer = await Fungibilizer.deploy(deployer.address);
  await fungibilizer.waitForDeployment();
  const fungibilizerAddr = await fungibilizer.getAddress();
  console.log("Fungibilizer deployed to:", fungibilizerAddr);

  // 2. Deploy FungibilityEngine (orchestrator)
  const ALPHA = hre.ethers.parseEther("1"); // 1 pool token per NFT
  const Engine = await hre.ethers.getContractFactory("FungibilityEngine");
  const engine = await Engine.deploy(fungibilizerAddr, ALPHA);
  await engine.waitForDeployment();
  const engineAddr = await engine.getAddress();
  console.log("FungibilityEngine deployed to:", engineAddr);

  // 3. Register engine on Fungibilizer (one-time)
  const tx = await fungibilizer.setEngine(engineAddr);
  await tx.wait();
  console.log("Engine registered on Fungibilizer");

  // 4. Mint initial batch of Fungibilizer tokens
  const INITIAL_SUPPLY = 100;
  const mintTx = await fungibilizer.mint(deployer.address, INITIAL_SUPPLY);
  await mintTx.wait();
  console.log(`Minted ${INITIAL_SUPPLY} Fungibilizer tokens to deployer`);

  console.log("\n--- Deployment Summary ---");
  console.log("Fungibilizer (ERC-721):", fungibilizerAddr);
  console.log("FungibilityEngine:     ", engineAddr);
  console.log("Pool Token Impl:       ", await engine.poolTokenImplementation());
  console.log("Alpha (α):             ", hre.ethers.formatEther(ALPHA), "tokens per NFT");
  console.log("Initial Fungibilizers: ", INITIAL_SUPPLY);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
