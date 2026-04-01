/**
 * Example: Funging an NFT
 *
 * This script demonstrates the complete funging flow:
 * 1. Deploy all contracts
 * 2. Mint a Fungibilizer token and an NFT
 * 3. Funge the NFT → receive pool tokens
 *
 * Run: npx hardhat run examples/funge.js
 */

const hre = require("hardhat");

async function main() {
  const [deployer, alice] = await hre.ethers.getSigners();

  console.log("=== Fungibilizer Example: Funging an NFT ===\n");

  // --- Setup ---
  const Fungibilizer = await hre.ethers.getContractFactory("Fungibilizer");
  const fungibilizer = await Fungibilizer.deploy(deployer.address);

  const ALPHA = hre.ethers.parseEther("1");
  const Engine = await hre.ethers.getContractFactory("FungibilityEngine");
  const engine = await Engine.deploy(await fungibilizer.getAddress(), ALPHA);

  await fungibilizer.setEngine(await engine.getAddress());

  const MockNFT = await hre.ethers.getContractFactory("MockNFT");
  const nft = await MockNFT.deploy("Bored Ape Yacht Club", "BAYC");

  console.log("Contracts deployed.");
  console.log("  Fungibilizer:", await fungibilizer.getAddress());
  console.log("  Engine:      ", await engine.getAddress());
  console.log("  Mock NFT:    ", await nft.getAddress());

  // --- Mint assets to Alice ---
  await fungibilizer.mint(alice.address, 3);
  await nft.mintBatch(alice.address, 3);

  console.log("\nAlice's assets before funging:");
  console.log("  Fungibilizers: 3 (IDs: 0, 1, 2)");
  console.log("  BAYCs:         3 (IDs: 0, 1, 2)");

  // --- Approve Engine ---
  const engineAddr = await engine.getAddress();
  await fungibilizer.connect(alice).setApprovalForAll(engineAddr, true);
  await nft.connect(alice).setApprovalForAll(engineAddr, true);

  // --- Funge NFT #0 using Fungibilizer #0 ---
  console.log("\n--- Funging BAYC #0 using Fungibilizer #0 ---");
  const tx = await engine.connect(alice).funge(0, await nft.getAddress(), 0);
  const receipt = await tx.wait();

  // Check results
  const poolAddr = await engine.getPool(await nft.getAddress());
  const pool = await hre.ethers.getContractAt("PoolToken", poolAddr);

  console.log("\nResult:");
  console.log("  Pool created:     ", poolAddr);
  console.log("  Pool token name:  ", await pool.name());
  console.log("  Pool token symbol:", await pool.symbol());
  console.log("  Alice fBAYC bal:  ", hre.ethers.formatEther(await pool.balanceOf(alice.address)), "fBAYC");
  console.log("  Vault size:       ", (await engine.getVaultSize(await nft.getAddress())).toString(), "NFTs");
  console.log("  Fungibilizers left:", (await fungibilizer.remainingSupply()).toString());
  console.log("  Gas used:         ", receipt.gasUsed.toString());

  // --- Funge another ---
  console.log("\n--- Funging BAYC #1 using Fungibilizer #1 ---");
  const tx2 = await engine.connect(alice).funge(1, await nft.getAddress(), 1);
  const receipt2 = await tx2.wait();

  console.log("\nResult:");
  console.log("  Alice fBAYC bal:  ", hre.ethers.formatEther(await pool.balanceOf(alice.address)), "fBAYC");
  console.log("  Vault size:       ", (await engine.getVaultSize(await nft.getAddress())).toString(), "NFTs");
  console.log("  Vault contents:   ", (await engine.getVaultContents(await nft.getAddress())).map(String));
  console.log("  Fungibilizers left:", (await fungibilizer.remainingSupply()).toString());
  console.log("  Gas used:         ", receipt2.gasUsed.toString(), "(cheaper — pool already exists)");

  // Verify conservation invariant
  const supply = await pool.totalSupply();
  const vaultSize = await engine.getVaultSize(await nft.getAddress());
  console.log("\n--- Conservation Invariant ---");
  console.log(`  S = ${hre.ethers.formatEther(supply)}, α·n = ${hre.ethers.formatEther(ALPHA * vaultSize)}`);
  console.log(`  S = α·n? ${supply === ALPHA * vaultSize}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
