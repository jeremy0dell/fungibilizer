# THE FUNGIBILIZER

**A Protocol for Transmuting Non-Fungible Tokens into Fungible Units and Back Again**

White Paper v1.7.38 — April 1 2026

> *"To fung, or not to fung — that is the question."*
>
> *"Sometimes you're the funger. Sometimes you get funged."*

---

## 1. Abstract

Non-fungible tokens represent unique digital assets, but their indivisibility creates a fundamental liquidity problem: individual NFTs cannot be partially sold, efficiently collateralized, or composed with DeFi protocols that operate on fungible units. Existing approaches to NFT fungibilization introduce governance overhead, require trust assumptions about price discovery, or create permanently fragmented ownership structures.

We present the Fungibilizer, a protocol that converts NFTs into fungible pool tokens through a scarce, consumable catalyst mechanism. The protocol comprises three contracts: a scarce ERC-721 Fungibilizer token that is permanently burned upon use, a FungibilityEngine orchestrator, and per-collection ERC-20 PoolTokens backed 1:1 by vaulted NFTs. Funging consumes a Fungibilizer token, vaults the target NFT, and mints fungible pool tokens; defunging burns pool tokens and returns a random NFT from the vault. The scarcity of the Fungibilizer token introduces a novel rate-limiting mechanism that governs the pace of fungibilization, while the random-return property of defunging ensures vault neutrality. The system requires no oracle, no governance, and no off-chain components.

## 2. Introduction

ERC-721 tokens encode uniqueness. Each has a distinct identifier and cannot be substituted for another. This is valuable when identity matters — for art provenance, deed registration, or membership credentials — but it creates friction in contexts where participants are indifferent to which specific token they hold.

Many NFT collections contain tokens that the market treats as roughly equivalent. Floor-price trading on OpenSea and Blur already reflects this: buyers bid on "any token from collection X" rather than a specific one. The tokens are economically fungible but technically non-fungible. This mismatch limits composability with DeFi protocols, which are built on fungible primitives — liquidity pools, lending markets, and yield strategies all require interchangeable units.

Existing solutions address this through protocol-specific vaults (NFTX), bonding-curve AMMs (Sudoswap), per-NFT fractionalization (Fractional.art/Tessera, now shut down), and lending against NFT collateral (BendDAO, JPEG'd). Each introduces tradeoffs in governance complexity, oracle dependency, or access structure. Section 7 examines these in detail.

The Fungibilizer introduces a different concept: a **token-gated power**. The ability to fung is itself an asset — scarce, transferable, and consumed on use. This creates a two-market structure absent from all prior work: a market for the act of transformation (Fungibilizer tokens) alongside a market for the transformation's output (pool tokens).

## 3. Terminology: The Verb "To Fung"

The protocol introduces **"fung"** as a verb describing the act of converting a non-fungible token into fungible units. The full conjugation and derived forms are as follows:

| Form | Term |
|---|---|
| Infinitive | to fung |
| Present | fung / fungs |
| Past | funged |
| Gerund | funging |
| Agent noun | funger |
| Reverse | defung |
| Reverse past | defunged |
| Reverse gerund | defunging |
| Tool noun | Fungibilizer |
| State (adj.) | fungibilized |

The distinction between "fung" and "defung" is intentional and asymmetric. Funging requires a Fungibilizer (scarce, consumed). Defunging requires only pool tokens (abundant, freely traded). This asymmetry is a core design property, not an oversight.

## 4. Formal Specification

This section defines the protocol's state, invariants, and operations using notation adapted from Uniswap v2 [1]. We use Roman lowercase for state variables, subscripts 0 and 1 for pre- and post-transaction state, and uppercase for sets.

### 4.1 State Variables

The system's state for a given NFT collection *c* is described by four variables:

| Variable | Description |
|---|---|
| **S** | Total supply of pool tokens for collection *c* |
| **n** | Number of NFTs in the vault for collection *c* |
| **V** | Set of NFT token IDs in the vault for collection *c* |
| **F** | Global supply of unconsumed Fungibilizer tokens |

The Fungibilizer supply **F** is global (not per-collection) and monotonically non-increasing: every funge reduces **F** by exactly 1, regardless of which collection is targeted.

### 4.2 Conservation Invariant

The protocol maintains a single conservation law at all times, for every collection *c*:

```
S = α · n
```

The total supply of pool tokens for a collection equals the protocol constant **α** multiplied by the number of NFTs in the vault. When α = 1 (the default), this simplifies to **S = n**: one pool token exists for every vaulted NFT.

This invariant holds trivially at pool creation (S₀ = 0, n₀ = 0), is preserved by funging (both S and n increase by α and 1 respectively), and is preserved by defunging (both decrease correspondingly). No operation in the protocol can violate it.

### 4.3 Operation: Pool Creation

When the first funge targets collection *c*, the Engine deploys a new PoolToken contract. The initial state is:

```
S₀ = 0,  n₀ = 0,  V₀ = ∅
```

Pre-conditions: *c* must be a valid ERC-721 contract address with no existing pool. Pool creation is atomic with the first funge — it cannot be called independently, ensuring no empty pools exist.

### 4.4 Operation: Funging

Given a caller **a** holding Fungibilizer token **f** and NFT **t** from collection **c**:

**Pre-conditions:**

```
ownerOf(f) = a
IERC721(c).ownerOf(t) = a
F ≥ 1
```

**State transition:**

```
n₁ = n₀ + 1
S₁ = S₀ + α
V₁ = V₀ ∪ {t}
F₁ = F₀ − 1
balance(a)₁ = balance(a)₀ + α
```

**Post-conditions:**

```
S₁ = α · n₁          (invariant preserved)
Fungibilizer f is burned  (permanent, irreversible)
NFT t is held by Engine   (vaulted)
```

**Worked example.** Alice holds Fungibilizer #42 (one of 10,000 minted) and BAYC #1234. The BAYC vault currently holds 15 NFTs with 15 pBAYC tokens in circulation. Alice calls `funge()`: Fungibilizer #42 is burned (Fungibilizer supply drops to 9,998), BAYC #1234 enters the vault (now 16 NFTs), and 1.0 pBAYC is minted to Alice (supply now 16). Conservation holds: S₁ = 16 = 1 × 16 = α · n₁.

### 4.5 Operation: Defunging

Given a caller **a** holding at least α pool tokens for collection *c*, with vault V₀ containing n₀ ≥ 1 NFTs:

**State transition:**

```
j ← random selection from V₀, where Pr[j = vᵢ] = 1/n₀ for all vᵢ ∈ V₀
n₁ = n₀ − 1
S₁ = S₀ − α
V₁ = V₀ \ {j}
balance(a)₁ = balance(a)₀ − α
IERC721(c).ownerOf(j) = a
```

The selection of **j** is uniform random over all vault contents. The caller does not choose which NFT they receive. This is not a limitation — it is the mechanism by which fungibility is enforced. If holders could select specific NFTs on withdrawal, pool tokens would not be genuinely fungible.

**Worked example.** Bob acquires 1.0 pBAYC on Uniswap and calls `defunge()`. The vault holds 16 NFTs. 1.0 pBAYC is burned (supply drops to 15), the vault randomly returns BAYC #7891 to Bob — not Alice's original #1234. That is the fungibilization at work. Conservation holds: S₁ = 15 = 1 × 15 = α · n₁.

### 4.6 Fungibilizer Scarcity

Let **M** be the total number of Fungibilizer tokens ever minted, and **m** the total number of funges executed historically. Then:

```
F = M − m
```

**F** is monotonically non-increasing. When F = 0, no further funging is possible, though defunging continues indefinitely. The terminal state of the protocol is one where all Fungibilizer tokens have been consumed and only pool tokens and vaulted NFTs remain.

## 5. Mechanism Design

### 5.1 The Fungibilizer Token

The Fungibilizer is an ERC-721 token. It is non-fungible itself — each has a unique ID and an owner. But its function is singular: it grants its holder the right to fung one NFT. Upon use, the Fungibilizer is burned. One Fungibilizer, one funging, then it ceases to exist.

This creates a second-order market. The Fungibilizer is a consumable tool whose value derives from the value of funging. If a collection's floor price is high and there is demand for fungible exposure to that collection, Fungibilizers become valuable. If no one wants to fung anything, they are worthless.

**The market prices the act itself.**

### 5.2 The Funging Process

The core operation proceeds in five atomic steps within a single transaction:

1. **Ownership verification.** The caller must hold both the Fungibilizer token and the target NFT.
2. **Fungibilizer consumption.** The Fungibilizer is burned. It cannot be reused.
3. **NFT custody transfer.** The target NFT is transferred from the caller to the Engine contract's vault.
4. **Pool creation (if needed).** If no fungible pool exists for the target NFT's collection, one is deployed automatically as a new ERC-20 contract using the EIP-1167 minimal proxy pattern.
5. **Fungible token minting.** The caller receives α fungible pool tokens representing their dissolved NFT.

The entire sequence is atomic. If any step fails — the caller doesn't own the Fungibilizer, doesn't own the NFT, or hasn't approved the transfer — the transaction reverts entirely.

### 5.3 The Defunging Process

Defunging is the reverse: burning α pool tokens to withdraw an NFT from the vault. The caller does not choose which NFT they receive. The vault returns a uniformly random token from its contents. This is the mechanism by which fungibility is enforced.

Defunging does not require a Fungibilizer. Anyone holding pool tokens can defung at any time. This asymmetry — funging is gated and scarce, defunging is open and permissionless — ensures that the Fungibilizer's value accrues from the act of dissolution, not from reversal.

## 6. Contract Architecture

The protocol consists of three interdependent contracts:

| Contract | Standard | Role |
|---|---|---|
| **Fungibilizer** | ERC-721 | Scarce, consumable catalyst token |
| **FungibilityEngine** | — | Orchestrator: vaults NFTs, deploys pools, enforces invariants |
| **PoolToken** | ERC-20 | Per-collection fungible token backed by vaulted NFTs |

The Engine is the only contract with minting and burning authority over Pool Tokens. The Fungibilizer contract delegates its burn function to the Engine. No contract holds admin keys or upgrade proxies in the base implementation.

### 6.1 Trust Model

The protocol is trust-minimized in operation but trust-dependent at initialization. The Engine address must be set on the Fungibilizer contract, and this can only be done once. After initialization, the system is fully autonomous: no party can mint pool tokens without burning a Fungibilizer, and no party can extract NFTs without burning pool tokens.

Fungibilizer minting is the one privileged action. Whoever controls the mint function on the Fungibilizer contract controls the supply of funging power. In a production deployment, this could be governed by a DAO, a bonding curve, a fixed supply cap, or any other issuance mechanism.

### 6.2 Contract Interactions

The funging flow involves four external calls in sequence, all within one transaction:

```
User → Engine.funge(fungibilizerId, nftContract, nftId)
  Engine → Fungibilizer.consume(fungibilizerId)    // burns the Fungibilizer
  Engine → IERC721(nftContract).transferFrom(user, engine, nftId)
  Engine → PoolToken.mint(user, α)                  // mints pool tokens
```

The defunging flow is simpler:

```
User → Engine.defunge(nftContract)
  Engine → PoolToken.burn(user, α)                  // burns pool tokens
  Engine → IERC721(nftContract).transferFrom(engine, user, randomNftId)
```

In both cases, state updates (vault bookkeeping, supply tracking) occur before external calls, following the checks-effects-interactions pattern to prevent reentrancy.

## 7. Related Work

NFT-DeFi protocols fall into five categories. The Fungibilizer introduces a distinct approach within the vault/pooling category by gating access through a consumable token.

### 7.1 NFTX — Permissionless Vault Pooling

NFTX allows anyone to create ERC-20 vaults for NFT collections, depositing NFTs to mint fungible vTokens at a 1:1 ratio and redeeming vTokens to withdraw NFTs. vTokens are paired with WETH on AMMs for price discovery. Default fees range from 3–10% depending on operation type (mint, random redeem, targeted redeem). NFTX v3 integrates concentrated liquidity via an adapted Uniswap v3 position manager.

The Fungibilizer departs from NFTX in a fundamental structural way: NFTX is permissionless and unmetered — anyone can mint vTokens at any time by depositing an eligible NFT. The Fungibilizer requires burning a scarce, consumable ERC-721 access token, transforming the act of funging from a routine liquidity operation into a strategic, resource-constrained decision with its own market dynamics.

### 7.2 Sudoswap — Bonding-Curve AMM

sudoAMM deploys on-chain bonding-curve pools (linear, exponential, XYK) for direct NFT-to-ETH swaps. Liquidity providers set price curves and the protocol executes swaps along them. While Sudoswap achieves instant NFT liquidity at the floor level, it does not produce a persistent fungible derivative token. The Fungibilizer produces persistent ERC-20 pool tokens that enable downstream DeFi composability — lending, LP provision, index construction — which Sudoswap's direct-swap model cannot support.

### 7.3 Fractional.art / Tessera — Per-NFT Fractionalization

Fractional.art pioneered per-NFT fractionalization: lock one ERC-721, mint arbitrary ERC-20 fraction tokens representing collective ownership of that specific asset. A weighted-average reserve-price mechanism governed buyout auctions. The model suffered from low repeat usage (the majority of curators used the protocol only once), securities-law ambiguity around fraction tokens, and unsustainable economics. Fractional rebranded to Tessera, pivoted to a hyperstructure model, then ceased all operations in May 2023.

The Fungibilizer avoids Fractional's governance complexity (no reserve-price voting, no buyout auctions) by creating collection-level pools where individual identity is dissolved entirely. Gates access through a consumable token rather than permissionless fractionalization.

### 7.4 BendDAO — NFT-Collateralized Lending

BendDAO implements Aave-style peer-to-pool NFT lending with oracle-driven liquidation. In August 2022, a sharp decline in BAYC floor prices triggered near-bank-run conditions, with the protocol's available liquidity dropping to critically low levels before emergency measures stabilized the system. The incident illustrates the systemic risk of oracle-dependent NFT collateralization.

The Fungibilizer eliminates this entire class of risk: no oracle, no interest accrual, no liquidation mechanics. The exchange rate (1 NFT = α pool tokens) is structurally defined, not market-derived.

### 7.5 ERC-1155 — Semi-Fungibility at the Standard Level

The Multi Token Standard provides a unified interface for fungible, non-fungible, and semi-fungible tokens within a single contract. However, ERC-1155 handles semi-fungibility at the representation layer: a token ID's fungibility is determined statically at creation by its supply. The Fungibilizer implements dynamic state transformation: an ERC-721 enters as non-fungible and is converted into ERC-20 pool tokens through a vault mechanism. This is an operational approach to the fungibility boundary, not a representational one.

### 7.6 Comparison Summary

| Protocol | Mechanism | Oracle | Governance | Fungible Output | Consumable Gate |
|---|---|---|---|---|---|
| NFTX | Vault pool | No | Vault-level | ERC-20 vToken | No |
| Sudoswap | Bonding curve AMM | No | Pool-level | None (direct swap) | No |
| Fractional/Tessera | Per-NFT fractionalization | No | Reserve price voting | ERC-20 fractions | No |
| BendDAO | Collateralized lending | Yes | Protocol-level | None (debt position) | No |
| **Fungibilizer** | **Catalyst-gated vault** | **No** | **None** | **ERC-20 pool token** | **Yes** |

## 8. Economic Properties

### 8.1 Three Asset Classes

The protocol creates three distinct asset classes, each with independent price dynamics:

- **Fungibilizer tokens** derive value from demand for the act of funging. Their price reflects the market's appetite for converting NFTs into liquid, fungible exposure.
- **Pool tokens** derive value from the NFTs locked in their vault. A pool token for a collection with a 2 ETH floor should trade near 2 ETH, minus any liquidity discount.
- **Vault NFTs** are the underlying collateral. Their market value sets the floor for pool token pricing.

### 8.2 Scarcity Dynamics

The Fungibilizer's single-use, burn-on-consumption design creates deflationary pressure. Each funging permanently reduces the supply of Fungibilizers. If minting is capped or slowed, the remaining supply becomes increasingly scarce as demand persists. The Fungibilizer is closer to a match than to a key — a consumable commodity, not a durable tool.

### 8.3 Arbitrage and Price Discovery

Pool tokens enable a novel arbitrage loop that keeps their price tethered to the underlying collection's floor:

**Pool token underpriced.** Suppose pBAYC trades at 1.8 ETH but the BAYC floor price is 2.1 ETH. An arbitrageur buys 1.0 pBAYC for 1.8 ETH on a DEX, calls `defunge()` to receive a BAYC from the vault, and sells it at market for approximately 2.1 ETH — netting ~0.3 ETH minus gas. This buying pressure pushes pBAYC toward the floor.

**Pool token overpriced.** Suppose pBAYC trades at 2.4 ETH while the BAYC floor is 2.1 ETH. An NFT holder acquires a Fungibilizer (say, 0.1 ETH), fungs a floor-price BAYC purchased for 2.1 ETH, and sells the resulting pBAYC for 2.4 ETH — netting ~0.2 ETH after Fungibilizer cost and gas. This selling pressure pushes pBAYC back toward the floor.

In equilibrium, pool token price approximates: **floor price ± (Fungibilizer cost + gas + liquidity premium)**. The Fungibilizer cost acts as a natural spread.

## 9. Security Analysis

This section examines five classes of attacks relevant to the Fungibilizer's design, drawing on real exploits from comparable protocols.

### 9.1 Reentrancy via ERC-721 Callbacks

ERC-721's `safeTransferFrom` invokes the `onERC721Received` callback on recipient contracts, creating a reentrancy window. This vector has caused real losses: the Omni Protocol exploit (July 2022, $1.4M) used this callback to re-enter borrow functions before collateral accounting was updated.

The Fungibilizer mitigates this through two measures. First, vault-bound transfers use `transferFrom()` rather than `safeTransferFrom()`, skipping the callback entirely. Second, all state-changing functions apply OpenZeppelin's `ReentrancyGuard`. Third, the contract follows checks-effects-interactions ordering: all state updates (Fungibilizer burn, vault push, pool token mint) complete before any external call.

### 9.2 Flash Loan Resistance

NFTX has been exploited via flash loans: an attacker flash-borrowed vTokens, redeemed for NFTs, claimed associated airdrops, re-deposited, and repaid the loan in a single transaction. The Fungibilizer has a built-in structural defense against this pattern: funging requires burning a Fungibilizer NFT. Fungibilizer NFTs are ERC-721 tokens that cannot be flash-borrowed through standard flash loan protocols (which operate on ERC-20 tokens). An atomic flash-funge-defunge cycle is not economically viable because the Fungibilizer is permanently destroyed.

### 9.3 Vault Quality Griefing

An attacker could deposit the cheapest NFTs from a collection to dilute vault quality, causing defungers to receive below-average tokens. NFTX addresses this with eligibility modules (Merkle trees restricting accepted tokenIds) and premium fees on recently deposited NFTs.

The Fungibilizer's natural defense is the cost of the Fungibilizer token itself: each griefing deposit permanently consumes a scarce asset. The economic cost of griefing is bounded below by the market price of a Fungibilizer. Future extensions could add eligibility lists or trait-weighted minting ratios to further mitigate this vector.

### 9.4 Randomness in Defunging

The NFT selection during defunge must resist manipulation. On-chain randomness is constrained: `blockhash` is only available for the most recent 256 blocks and is vulnerable to validator manipulation. The `block.prevrandao` value (available post-merge) provides adequate entropy for floor-priced collections where intra-collection value variance is low.

For high-value collections with significant trait-based price dispersion, Chainlink VRF provides cryptographically verifiable randomness at a cost of approximately 200,000 additional gas per request and an asynchronous fulfillment model. The base implementation uses `prevrandao` with a documented upgrade path to VRF.

### 9.5 Oracle Independence

The Fungibilizer's core operations require no price oracle. The exchange rate (1 NFT = α pool tokens) is structurally defined. This eliminates an entire class of attacks: oracle manipulation has caused hundreds of millions in losses across DeFi protocols (bZx, Cream Finance, Mango Markets). Oracle independence is a deliberate design choice, not an omission.

## 10. Gas Considerations

Following Uniswap v2's approach of discussing gas in terms of key design decisions and SSTORE counts rather than exhaustive benchmarks, this section addresses the protocol's two primary gas-relevant properties.

### 10.1 First-Funge Pool Deployment

The first funge targeting a new collection must deploy a PoolToken contract. A full ERC-20 deployment costs approximately 2,000,000–2,500,000 gas (comparable to Uniswap v2's `createPair` at roughly 2,500,000 gas). Combined with NFT transfer (~55,000), ERC-20 mint (~55,000), Fungibilizer burn (~35,000), and vault bookkeeping (~22,000), the first-funge transaction would reach approximately 2,500,000 gas — roughly 10× the cost of subsequent funges.

The protocol addresses this by deploying PoolTokens as **EIP-1167 minimal proxies**. Each PoolToken is a 45-byte proxy that delegates to a shared implementation contract, reducing deployment cost from approximately 2,000,000 gas to approximately 70,000 gas — a 95%+ reduction. First-funge transactions cost approximately 300,000–400,000 gas, only 1.5–2× the cost of subsequent funges.

### 10.2 Operation Gas Estimates

| Operation | Estimated Gas | Notes |
|---|---|---|
| `funge()` (existing pool) | ~250,000 | Burn + transfer + mint + vault bookkeeping |
| `funge()` (new pool) | ~350,000 | Adds EIP-1167 proxy deployment |
| `defunge()` | ~200,000 | Burn pool tokens + transfer NFT + vault bookkeeping |
| `createPool()` | ~100,000 | Standalone pool pre-deployment |

The Engine exposes a standalone `createPool(collection)` function, allowing anyone (protocol operator, DAO, MEV searcher) to pre-pay the deployment cost for a collection before the first funge occurs. This is optional — the default path creates the pool atomically during the first funge.

## 11. Applications

### 11.1 Instant NFT Liquidity

An NFT holder who needs immediate liquidity but can't find a buyer for their specific token can fung it and sell the resulting pool tokens on any DEX. The pool token is a standard ERC-20 — it can be traded on Uniswap, used as collateral on Aave, or deposited in a yield farm. The NFT's unique identity is traded for immediate, frictionless liquidity.

### 11.2 Collection Index Exposure

Pool tokens function as an index of a collection's floor. Holding fPUNK (fungibilized CryptoPunks) gives the holder price exposure to the CryptoPunk floor without needing to select, custody, or manage a specific punk. This enables passive exposure to NFT collections in the same way an ETF enables passive exposure to a stock index.

### 11.3 DeFi Composability

Because pool tokens are ERC-20, they plug directly into existing DeFi infrastructure: automated market makers for trading, lending protocols for borrowing against NFT exposure, options protocols for hedging, and yield aggregators for passive returns. None of this is possible with raw ERC-721 tokens.

### 11.4 The Fungibilizer as a Game or Governance Mechanic

Beyond financial applications, the Fungibilizer's design — a consumable token that permanently transforms another token — is a flexible primitive. It could represent a one-time power in a game (a spell that dissolves a unique item into currency), a governance action (a vote to commoditize a resource), or a social signal (publicly choosing to fung a rare NFT is a statement about value).

## 12. Risks and Limitations

**Vault composition risk.** Not all NFTs in a collection are equally desirable. If holders selectively fung only the least valuable tokens (those with undesirable traits), the vault accumulates low-quality inventory. In the worst case, if 100% of funged tokens are floor-trait items, the vault's average value per token approaches the floor while pool tokens are priced at the collection mean. Defungers absorb this discount. This is the classic adverse selection problem and is inherent to any pooling mechanism.

**Fungibilizer supply governance.** Whoever controls Fungibilizer minting has significant power over the protocol's economics. Excessive minting devalues Fungibilizers. Insufficient minting starves the protocol of activity. The issuance mechanism must be designed carefully for the specific deployment context.

**Smart contract risk.** The protocol relies on correct interaction between three contracts and arbitrary external ERC-721 contracts. Non-standard NFT implementations, unexpected transfer hooks, or reentrancy vectors could create vulnerabilities. Production deployment requires thorough auditing by a reputable security firm.

**Irreversibility of identity loss.** Funging destroys the NFT's unique identity permanently. If a holder fungs a token with rare traits and later regrets it, they cannot recover that specific token. Defunging produces a new, randomly selected token. This is by design, but users must understand it before funging.

**Randomness limitations.** The base implementation's use of `block.prevrandao` for defunge selection is adequate for low-variance collections but may be insufficient for collections with extreme trait-based price dispersion. Validators could theoretically manipulate `prevrandao` to influence which NFT they receive during a defunge, though the economic viability of such manipulation is limited by the cost of being a validator.

## 13. Future Directions

- **Multi-charge Fungibilizers.** Rather than single-use, a Fungibilizer could carry multiple charges — allowing the holder to fung N tokens before the Fungibilizer is exhausted. This creates a more durable tool with different pricing dynamics.
- **Trait-weighted pools.** Instead of treating all tokens in a collection as equivalent, a trait oracle could assign weights to funged tokens. A rare NFT might yield more pool tokens than a common one. This partially addresses adverse selection but reintroduces non-fungibility at the pool level.
- **Cross-chain funging.** The Fungibilizer could operate across chains via bridge protocols, funging an NFT on one chain and minting pool tokens on another where DeFi liquidity is deeper.
- **Fungibilizer DAOs.** Communities could collectively govern Fungibilizer minting, creating cooperative structures that decide when and how funging power enters circulation.
- **Chainlink VRF integration.** For high-value collections, replacing `prevrandao` with Chainlink VRF for defunge selection would provide cryptographically verifiable randomness at the cost of an asynchronous fulfillment model.

## 14. Conclusion

The Fungibilizer protocol reframes the relationship between fungibility and non-fungibility as a permeable boundary rather than a fixed property. By encoding the power to cross that boundary in a scarce, consumable token, the protocol creates a market for the act of transformation itself.

To fung is to make a choice: to trade uniqueness for liquidity, identity for interchangeability, provenance for composability. The Fungibilizer makes that choice explicit, atomic, and economically priced.

The protocol is intentionally minimal. Three contracts, two operations, one invariant: **S = α · n**. Everything else — issuance curves, governance models, trait weighting, cross-chain bridges — can be layered on top without modifying the core. The act of funging is the primitive. Everything else is application.

## 15. References

1. H. Adams, N. Zinsmeister, and D. Robinson. "Uniswap v2 Core." 2020.
2. H. Adams, N. Zinsmeister, M. Salem, R. Keefer, and D. Robinson. "Uniswap v3 Core." 2021.
3. S. Nakamoto. "Bitcoin: A Peer-to-Peer Electronic Cash System." 2008.
4. V. Buterin. "Ethereum: A Next-Generation Smart Contract and Decentralized Application Platform." 2014.
5. NFTX Protocol. "Introducing NFTX v3." docs.nftx.io, 2024.
6. Sudoswap. "sudoAMM Documentation." docs.sudoswap.xyz, 2022.
7. Fractional.art (Tessera). "Ceased operations." May 2023.
8. BendDAO. "BendDAO Protocol Documentation." docs.benddao.xyz, 2022.
9. W. Entriken, D. Shirley, J. Evans, N. Sachs. "EIP-721: Non-Fungible Token Standard." 2018.
10. P. Murray, N. Johnson, and F. Vogelstella. "EIP-1167: Minimal Proxy Contract." 2018.
11. EIP-1155: Multi Token Standard. 2018.

---

*To fung, or not to fung — that is the question.*

*The protocol answers it.*
