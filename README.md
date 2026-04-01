<p align="center">
  <img src="brand/icon-primary-512.png" alt="Fungibilizer" width="160" height="160">
</p>

<h1 align="center">The Fungibilizer</h1>

<p align="center">
  Turn any NFT into a fungible token. Turn it back.
</p>

<p align="center">
  <a href="docs/whitepaper.md"><strong>Whitepaper &rarr;</strong></a>&nbsp;&nbsp;&bull;&nbsp;&nbsp;<a href="https://fungibilizer.vercel.app">Website</a>
</p>

---

Deposit an NFT, burn a Fungibilizer, get pool tokens. Burn pool tokens, get a random NFT back. Three contracts, two operations, one invariant. No oracle, no governance, no off-chain components.

## Architecture

| Contract | Standard | What it does |
|---|---|---|
| `Fungibilizer` | ERC-721 | One-time-use catalyst — burned when you funge |
| `FungibilityEngine` | — | Vaults NFTs, deploys pools, enforces the invariant |
| `PoolToken` | ERC-20 | Per-collection token backed 1:1 by vaulted NFTs (EIP-1167 clone) |

## Quick Start

```bash
npm install
npm run compile
npm test

# Run the examples
npm run example:funge
npm run example:defunge

# Local node
npx hardhat node          # terminal 1
npm run deploy:local      # terminal 2
```

## How It Works

**Funge** — requires a Fungibilizer (scarce, consumed)
```
Engine.funge(fungibilizerId, collection, nftId)
  ├─ Burns the Fungibilizer
  ├─ Moves the NFT into the vault
  ├─ Deploys a pool if first funge for this collection
  └─ Mints α pool tokens to caller
```

**Defunge** — requires only pool tokens
```
Engine.defunge(collection)
  ├─ Burns α pool tokens
  └─ Returns a random NFT from the vault
```

The asymmetry is the point: funging is gated and scarce, defunging is open and permissionless.

## The Invariant

```
S = α · n
```

Pool token supply always equals alpha times the number of vaulted NFTs. Enforced on-chain. Verified in the test suite.

## License

MIT
