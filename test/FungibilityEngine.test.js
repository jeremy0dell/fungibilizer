const { expect } = require("chai");
const hre = require("hardhat");

describe("Fungibilizer Protocol", function () {
  let fungibilizer, engine, mockNFT;
  let owner, alice, bob;
  const ALPHA = hre.ethers.parseEther("1");

  beforeEach(async function () {
    [owner, alice, bob] = await hre.ethers.getSigners();

    // Deploy Fungibilizer
    const Fungibilizer = await hre.ethers.getContractFactory("Fungibilizer");
    fungibilizer = await Fungibilizer.deploy(owner.address);

    // Deploy Engine
    const Engine = await hre.ethers.getContractFactory("FungibilityEngine");
    engine = await Engine.deploy(await fungibilizer.getAddress(), ALPHA);

    // Register engine
    await fungibilizer.setEngine(await engine.getAddress());

    // Deploy mock NFT collection
    const MockNFT = await hre.ethers.getContractFactory("MockNFT");
    mockNFT = await MockNFT.deploy("Bored Ape Yacht Club", "BAYC");

    // Mint some Fungibilizers to alice
    await fungibilizer.mint(alice.address, 5);

    // Mint some NFTs to alice
    await mockNFT.mintBatch(alice.address, 5);
  });

  describe("Deployment", function () {
    it("should set the correct engine on Fungibilizer", async function () {
      expect(await fungibilizer.engine()).to.equal(await engine.getAddress());
    });

    it("should not allow setting engine twice", async function () {
      await expect(
        fungibilizer.setEngine(alice.address)
      ).to.be.revertedWithCustomError(fungibilizer, "EngineAlreadySet");
    });

    it("should have correct alpha", async function () {
      expect(await engine.alpha()).to.equal(ALPHA);
    });

    it("should track minted supply", async function () {
      expect(await fungibilizer.totalMinted()).to.equal(5);
      expect(await fungibilizer.remainingSupply()).to.equal(5);
    });
  });

  describe("Funging", function () {
    it("should funge an NFT successfully", async function () {
      const nftAddr = await mockNFT.getAddress();
      const engineAddr = await engine.getAddress();

      // Approve engine to transfer the NFT and Fungibilizer
      await mockNFT.connect(alice).setApprovalForAll(engineAddr, true);
      await fungibilizer.connect(alice).setApprovalForAll(engineAddr, true);

      // Funge NFT #0 using Fungibilizer #0
      await expect(engine.connect(alice).funge(0, nftAddr, 0))
        .to.emit(engine, "Funged")
        .withArgs(alice.address, nftAddr, 0, 0);

      // Pool should exist
      const poolAddr = await engine.getPool(nftAddr);
      expect(poolAddr).to.not.equal(hre.ethers.ZeroAddress);

      // Alice should have 1 pool token
      const pool = await hre.ethers.getContractAt("PoolToken", poolAddr);
      expect(await pool.balanceOf(alice.address)).to.equal(ALPHA);

      // Vault should contain the NFT
      expect(await engine.getVaultSize(nftAddr)).to.equal(1);

      // Fungibilizer #0 should be burned
      await expect(fungibilizer.ownerOf(0)).to.be.reverted;
      expect(await fungibilizer.totalConsumed()).to.equal(1);
      expect(await fungibilizer.remainingSupply()).to.equal(4);
    });

    it("should auto-create pool on first funge", async function () {
      const nftAddr = await mockNFT.getAddress();
      const engineAddr = await engine.getAddress();

      await mockNFT.connect(alice).setApprovalForAll(engineAddr, true);
      await fungibilizer.connect(alice).setApprovalForAll(engineAddr, true);

      await expect(engine.connect(alice).funge(0, nftAddr, 0))
        .to.emit(engine, "PoolCreated");
    });

    it("should funge multiple NFTs into the same pool", async function () {
      const nftAddr = await mockNFT.getAddress();
      const engineAddr = await engine.getAddress();

      await mockNFT.connect(alice).setApprovalForAll(engineAddr, true);
      await fungibilizer.connect(alice).setApprovalForAll(engineAddr, true);

      await engine.connect(alice).funge(0, nftAddr, 0);
      await engine.connect(alice).funge(1, nftAddr, 1);
      await engine.connect(alice).funge(2, nftAddr, 2);

      const poolAddr = await engine.getPool(nftAddr);
      const pool = await hre.ethers.getContractAt("PoolToken", poolAddr);

      expect(await pool.balanceOf(alice.address)).to.equal(ALPHA * 3n);
      expect(await engine.getVaultSize(nftAddr)).to.equal(3);
      expect(await fungibilizer.totalConsumed()).to.equal(3);
    });

    it("should revert if caller does not own the Fungibilizer", async function () {
      const nftAddr = await mockNFT.getAddress();
      const engineAddr = await engine.getAddress();

      await mockNFT.connect(alice).setApprovalForAll(engineAddr, true);

      await expect(
        engine.connect(bob).funge(0, nftAddr, 0)
      ).to.be.revertedWithCustomError(engine, "NotOwnerOfFungibilizer");
    });

    it("should revert if caller does not own the NFT", async function () {
      const nftAddr = await mockNFT.getAddress();
      const engineAddr = await engine.getAddress();

      await fungibilizer.connect(alice).setApprovalForAll(engineAddr, true);

      // Bob doesn't own NFT #0
      await expect(
        engine.connect(alice).funge(0, nftAddr, 99)
      ).to.be.reverted;
    });
  });

  describe("Defunging", function () {
    beforeEach(async function () {
      const nftAddr = await mockNFT.getAddress();
      const engineAddr = await engine.getAddress();

      await mockNFT.connect(alice).setApprovalForAll(engineAddr, true);
      await fungibilizer.connect(alice).setApprovalForAll(engineAddr, true);

      // Funge 3 NFTs
      await engine.connect(alice).funge(0, nftAddr, 0);
      await engine.connect(alice).funge(1, nftAddr, 1);
      await engine.connect(alice).funge(2, nftAddr, 2);
    });

    it("should defunge and return an NFT from the vault", async function () {
      const nftAddr = await mockNFT.getAddress();
      const poolAddr = await engine.getPool(nftAddr);
      const pool = await hre.ethers.getContractAt("PoolToken", poolAddr);

      // Alice defunges
      await pool.connect(alice).approve(await engine.getAddress(), ALPHA);
      await expect(engine.connect(alice).defunge(nftAddr))
        .to.emit(engine, "Defunged");

      // Pool token balance decreases
      expect(await pool.balanceOf(alice.address)).to.equal(ALPHA * 2n);

      // Vault size decreases
      expect(await engine.getVaultSize(nftAddr)).to.equal(2);

      // Alice should have received one of the NFTs back
      const aliceNFTs = [];
      for (let i = 0; i < 5; i++) {
        try {
          const o = await mockNFT.ownerOf(i);
          if (o === alice.address) aliceNFTs.push(i);
        } catch {}
      }
      // Alice had NFTs 3,4 (unfunged) and should now have one more
      expect(aliceNFTs.length).to.equal(3);
    });

    it("should allow bob to defunge with transferred pool tokens", async function () {
      const nftAddr = await mockNFT.getAddress();
      const poolAddr = await engine.getPool(nftAddr);
      const pool = await hre.ethers.getContractAt("PoolToken", poolAddr);

      // Alice transfers pool tokens to bob
      await pool.connect(alice).transfer(bob.address, ALPHA);

      // Bob defunges
      await pool.connect(bob).approve(await engine.getAddress(), ALPHA);
      await engine.connect(bob).defunge(nftAddr);

      expect(await pool.balanceOf(bob.address)).to.equal(0);
    });

    it("should revert defunge on non-existent pool", async function () {
      await expect(
        engine.connect(alice).defunge(bob.address)
      ).to.be.revertedWithCustomError(engine, "PoolDoesNotExist");
    });

    it("should revert defunge on empty vault", async function () {
      const nftAddr = await mockNFT.getAddress();
      const poolAddr = await engine.getPool(nftAddr);
      const pool = await hre.ethers.getContractAt("PoolToken", poolAddr);

      // Defunge all 3
      for (let i = 0; i < 3; i++) {
        await pool.connect(alice).approve(await engine.getAddress(), ALPHA);
        await engine.connect(alice).defunge(nftAddr);
      }

      await expect(
        engine.connect(alice).defunge(nftAddr)
      ).to.be.revertedWithCustomError(engine, "VaultEmpty");
    });
  });

  describe("Conservation Invariant (S = α · n)", function () {
    it("should hold after multiple funges and defunges", async function () {
      const nftAddr = await mockNFT.getAddress();
      const engineAddr = await engine.getAddress();

      await mockNFT.connect(alice).setApprovalForAll(engineAddr, true);
      await fungibilizer.connect(alice).setApprovalForAll(engineAddr, true);

      // Funge 3
      await engine.connect(alice).funge(0, nftAddr, 0);
      await engine.connect(alice).funge(1, nftAddr, 1);
      await engine.connect(alice).funge(2, nftAddr, 2);

      const poolAddr = await engine.getPool(nftAddr);
      const pool = await hre.ethers.getContractAt("PoolToken", poolAddr);

      // Check invariant: S = α · n
      let supply = await pool.totalSupply();
      let vaultSize = await engine.getVaultSize(nftAddr);
      expect(supply).to.equal(ALPHA * vaultSize);

      // Defunge 1
      await pool.connect(alice).approve(engineAddr, ALPHA);
      await engine.connect(alice).defunge(nftAddr);

      // Check invariant again
      supply = await pool.totalSupply();
      vaultSize = await engine.getVaultSize(nftAddr);
      expect(supply).to.equal(ALPHA * vaultSize);

      // Funge 1 more
      await engine.connect(alice).funge(3, nftAddr, 3);

      supply = await pool.totalSupply();
      vaultSize = await engine.getVaultSize(nftAddr);
      expect(supply).to.equal(ALPHA * vaultSize);
    });
  });

  describe("Pool Token properties", function () {
    it("should have correct name and symbol", async function () {
      const nftAddr = await mockNFT.getAddress();
      const engineAddr = await engine.getAddress();

      await mockNFT.connect(alice).setApprovalForAll(engineAddr, true);
      await fungibilizer.connect(alice).setApprovalForAll(engineAddr, true);
      await engine.connect(alice).funge(0, nftAddr, 0);

      const poolAddr = await engine.getPool(nftAddr);
      const pool = await hre.ethers.getContractAt("PoolToken", poolAddr);

      expect(await pool.name()).to.equal("Fungibilized Bored Ape Yacht Club");
      expect(await pool.symbol()).to.equal("fBAYC");
    });

    it("should be transferable as standard ERC-20", async function () {
      const nftAddr = await mockNFT.getAddress();
      const engineAddr = await engine.getAddress();

      await mockNFT.connect(alice).setApprovalForAll(engineAddr, true);
      await fungibilizer.connect(alice).setApprovalForAll(engineAddr, true);
      await engine.connect(alice).funge(0, nftAddr, 0);

      const poolAddr = await engine.getPool(nftAddr);
      const pool = await hre.ethers.getContractAt("PoolToken", poolAddr);

      await pool.connect(alice).transfer(bob.address, ALPHA);
      expect(await pool.balanceOf(bob.address)).to.equal(ALPHA);
      expect(await pool.balanceOf(alice.address)).to.equal(0);
    });
  });

  describe("Pre-created pools", function () {
    it("should allow manual pool creation", async function () {
      const nftAddr = await mockNFT.getAddress();

      await expect(
        engine.createPool(nftAddr, "Fungibilized BAYC", "fBAYC")
      ).to.emit(engine, "PoolCreated");

      expect(await engine.getPool(nftAddr)).to.not.equal(hre.ethers.ZeroAddress);
    });

    it("should not allow duplicate pool creation", async function () {
      const nftAddr = await mockNFT.getAddress();
      await engine.createPool(nftAddr, "Fungibilized BAYC", "fBAYC");

      await expect(
        engine.createPool(nftAddr, "Fungibilized BAYC", "fBAYC")
      ).to.be.revertedWithCustomError(engine, "PoolAlreadyExists");
    });
  });
});
