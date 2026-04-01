/**
 * Example: Defunging — burning pool tokens to receive a random NFT
 *
 * This script demonstrates the full cycle:
 * 1. Alice funges 3 NFTs into pool tokens
 * 2. Alice transfers pool tokens to Bob
 * 3. Bob defunges — receives a random NFT from the vault
 *
 * Run: npx hardhat run examples/defunge.js
 */

const hre = require("hardhat");

async function main() {
  const [deployer, alice, bob] = await hre.ethers.getSigners();

  console.log("=== Fungibilizer Example: Defunging ===\n");

  // --- Setup ---
  const Fungibilizer = await hre.ethers.getContractFactory("Fungibilizer");
  const fungibilizer = await Fungibilizer.deploy(deployer.address);

  const ALPHA = hre.ethers.parseEther("1");
  const Engine = await hre.ethers.getContractFactory("FungibilityEngine");
  const engine = await Engine.deploy(await fungibilizer.getAddress(), ALPHA);
  await fungibilizer.setEngine(await engine.getAddress());

  const MockNFT = await hre.ethers.getContractFactory("MockNFT");
  const nft = await MockNFT.deploy("CryptoPunks", "PUNK");

  // Mint assets to Alice
  await fungibilizer.mint(alice.address, 3);
  await nft.mintBatch(alice.address, 3);

  const engineAddr = await engine.getAddress();
  const nftAddr = await nft.getAddress();
  await fungibilizer.connect(alice).setApprovalForAll(engineAddr, true);
  await nft.connect(alice).setApprovalForAll(engineAddr, true);

  // --- Alice funges 3 NFTs ---
  console.log("Step 1: Alice funges 3 CryptoPunks");
  await engine.connect(alice).funge(0, nftAddr, 0);
  await engine.connect(alice).funge(1, nftAddr, 1);
  await engine.connect(alice).funge(2, nftAddr, 2);

  const poolAddr = await engine.getPool(nftAddr);
  const pool = await hre.ethers.getContractAt("PoolToken", poolAddr);

  console.log("  Alice fPUNK balance:", hre.ethers.formatEther(await pool.balanceOf(alice.address)));
  console.log("  Vault contents:    ", (await engine.getVaultContents(nftAddr)).map(String));

  // --- Alice sends 1 fPUNK to Bob ---
  console.log("\nStep 2: Alice transfers 1.0 fPUNK to Bob");
  await pool.connect(alice).transfer(bob.address, ALPHA);
  console.log("  Alice fPUNK:", hre.ethers.formatEther(await pool.balanceOf(alice.address)));
  console.log("  Bob   fPUNK:", hre.ethers.formatEther(await pool.balanceOf(bob.address)));

  // --- Bob defunges ---
  console.log("\nStep 3: Bob defunges — burns 1.0 fPUNK, receives a random Punk");
  await pool.connect(bob).approve(engineAddr, ALPHA);
  const tx = await engine.connect(bob).defunge(nftAddr);
  const receipt = await tx.wait();

  // Find which NFT Bob received
  const defungedEvent = receipt.logs
    .map((log) => {
      try { return engine.interface.parseLog(log); } catch { return null; }
    })
    .find((e) => e && e.name === "Defunged");

  const receivedId = defungedEvent.args.nftId;
  console.log(`  Bob received: PUNK #${receivedId}`);
  console.log("  Bob fPUNK balance:", hre.ethers.formatEther(await pool.balanceOf(bob.address)));
  console.log("  Vault now contains:", (await engine.getVaultContents(nftAddr)).map(String));
  console.log("  Gas used:", receipt.gasUsed.toString());

  // --- Alice defunges one more ---
  console.log("\nStep 4: Alice defunges one of her remaining pool tokens");
  await pool.connect(alice).approve(engineAddr, ALPHA);
  const tx2 = await engine.connect(alice).defunge(nftAddr);
  const receipt2 = await tx2.wait();

  const defungedEvent2 = receipt2.logs
    .map((log) => {
      try { return engine.interface.parseLog(log); } catch { return null; }
    })
    .find((e) => e && e.name === "Defunged");

  console.log(`  Alice received: PUNK #${defungedEvent2.args.nftId}`);
  console.log("  Alice fPUNK balance:", hre.ethers.formatEther(await pool.balanceOf(alice.address)));
  console.log("  Vault now contains:", (await engine.getVaultContents(nftAddr)).map(String));

  // Final state
  console.log("\n--- Final State ---");
  console.log("  Pool token supply:", hre.ethers.formatEther(await pool.totalSupply()), "fPUNK");
  console.log("  Vault size:       ", (await engine.getVaultSize(nftAddr)).toString(), "NFTs");
  console.log("  Fungibilizers consumed:", (await fungibilizer.totalConsumed()).toString(), "of", (await fungibilizer.totalMinted()).toString());

  const supply = await pool.totalSupply();
  const vaultSize = await engine.getVaultSize(nftAddr);
  console.log(`\n  Conservation: S=${hre.ethers.formatEther(supply)}, α·n=${hre.ethers.formatEther(ALPHA * vaultSize)} ✓`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
