<p align="center">
  <img src="brand/icon-primary-512.png" alt="Fungibilizer" width="160" height="160">
</p>

<h1 align="center">The Fungibilizer</h1>

<p align="center">
  <strong>A Protocol for Transmuting Non-Fungible Tokens into Fungible Units and Back Again</strong>
</p>

<p align="center">
  <a href="docs/whitepaper.md"><strong>Read the Whitepaper &rarr;</strong></a>&nbsp;&nbsp;&bull;&nbsp;&nbsp;<a href="https://website-topaz-psi-78.vercel.app">Website</a>
</p>

<p align="center">
  <em>"To fung, or not to fung — that is the question."</em>
</p>

---

Three contracts. Two operations. One invariant: **S = &alpha; &middot; n**. Zero oracles. Zero governance.

The Fungibilizer converts NFTs into fungible ERC-20 pool tokens through a scarce, consumable catalyst mechanism. Funging burns a Fungibilizer token, vaults the target NFT, and mints pool tokens. Defunging burns pool tokens and returns a random NFT from the vault.

## Architecture

| Contract | Standard | Role |
|---|---|---|
| `Fungibilizer` | ERC-721 | Scarce, consumable catalyst token — burned on use |
| `FungibilityEngine` | — | Orchestrator: vaults NFTs, deploys pools, enforces invariants |
| `PoolToken` | ERC-20 | Per-collection fungible token (deployed as EIP-1167 proxy) |

## Quick Start

```bash
# Install dependencies
npm install

# Compile contracts
npm run compile

# Run tests
npm test

# Run examples
npm run example:funge
npm run example:defunge

# Deploy locally
npx hardhat node          # terminal 1
npm run deploy:local      # terminal 2
```

## How It Works

### Funging (NFT → Pool Tokens)

```
User → Engine.funge(fungibilizerId, collection, nftId)
  ├─ Burns the Fungibilizer token (consumed forever)
  ├─ Transfers the NFT into the vault
  ├─ Creates a pool if first funge for this collection
  └─ Mints α pool tokens to the caller
```

### Defunging (Pool Tokens → Random NFT)

```
User → Engine.defunge(collection)
  ├─ Burns α pool tokens from the caller
  └─ Transfers a random NFT from the vault to the caller
```

**Key asymmetry:** funging requires a scarce Fungibilizer token. Defunging requires only pool tokens.

## The Conservation Invariant

At all times, for every collection:

```
S = α · n
```

Pool token supply (`S`) equals alpha (`α`) times the number of vaulted NFTs (`n`). This is enforced by the contracts and verified in the test suite.

## License

MIT
