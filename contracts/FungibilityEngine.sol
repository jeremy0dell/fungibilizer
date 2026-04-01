// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "./interfaces/IFungibilizer.sol";
import "./interfaces/IFungibilityEngine.sol";
import "./PoolToken.sol";

/// @title FungibilityEngine
/// @notice Orchestrator contract that vaults NFTs, deploys per-collection ERC-20 pools,
///         and enforces the conservation invariant S = α · n.
///
///         Funging: burn a Fungibilizer → vault an NFT → mint pool tokens
///         Defunging: burn pool tokens → return a random NFT from the vault
contract FungibilityEngine is IFungibilityEngine, ReentrancyGuard {
    // ──────────────────────────────────────────────
    // State
    // ──────────────────────────────────────────────

    IFungibilizer public immutable fungibilizer;
    address public immutable poolTokenImplementation;

    /// @notice The number of pool tokens minted per NFT (α), expressed in wei.
    ///         Default: 1e18 (1 pool token per NFT)
    uint256 public immutable alpha;

    /// @dev collection address → PoolToken proxy address
    mapping(address => address) private _pools;

    /// @dev collection address → array of vaulted NFT token IDs
    mapping(address => uint256[]) private _vaults;

    /// @dev collection address → (tokenId → index+1 in _vaults array). 0 means not present.
    mapping(address => mapping(uint256 => uint256)) private _vaultIndex;

    error PoolAlreadyExists();
    error PoolDoesNotExist();
    error VaultEmpty();
    error NotOwnerOfFungibilizer(uint256 tokenId);
    error NotOwnerOfNFT(address collection, uint256 tokenId);

    // ──────────────────────────────────────────────
    // Constructor
    // ──────────────────────────────────────────────

    /// @param fungibilizer_ Address of the Fungibilizer ERC-721 contract
    /// @param alpha_ Pool tokens minted per NFT (in wei). Use 1e18 for 1:1.
    constructor(address fungibilizer_, uint256 alpha_) {
        fungibilizer = IFungibilizer(fungibilizer_);
        alpha = alpha_;

        // Deploy the master PoolToken implementation for EIP-1167 cloning
        poolTokenImplementation = address(new PoolToken());
    }

    // ──────────────────────────────────────────────
    // Pool creation
    // ──────────────────────────────────────────────

    /// @inheritdoc IFungibilityEngine
    function createPool(
        address collection,
        string memory name,
        string memory symbol
    ) public override {
        if (_pools[collection] != address(0)) revert PoolAlreadyExists();

        address pool = Clones.clone(poolTokenImplementation);
        PoolToken(pool).initialize(name, symbol, address(this));
        _pools[collection] = pool;

        emit PoolCreated(collection, pool);
    }

    // ──────────────────────────────────────────────
    // Core operations
    // ──────────────────────────────────────────────

    /// @inheritdoc IFungibilityEngine
    function funge(
        uint256 fungibilizerId,
        address collection,
        uint256 tokenId
    ) external override nonReentrant {
        // Checks
        if (IERC721(address(fungibilizer)).ownerOf(fungibilizerId) != msg.sender) {
            revert NotOwnerOfFungibilizer(fungibilizerId);
        }
        if (IERC721(collection).ownerOf(tokenId) != msg.sender) {
            revert NotOwnerOfNFT(collection, tokenId);
        }

        // Create pool on first funge for this collection
        if (_pools[collection] == address(0)) {
            // Derive name/symbol from collection — can be overridden via createPool()
            string memory name = string.concat("Fungibilized ", IERC721Metadata(collection).name());
            string memory sym = string.concat("f", IERC721Metadata(collection).symbol());
            createPool(collection, name, sym);
        }

        // Effects: update vault state before external calls
        _vaults[collection].push(tokenId);
        _vaultIndex[collection][tokenId] = _vaults[collection].length; // index + 1

        // Interactions
        fungibilizer.consume(fungibilizerId);
        IERC721(collection).transferFrom(msg.sender, address(this), tokenId);
        PoolToken(_pools[collection]).mint(msg.sender, alpha);

        emit Funged(msg.sender, collection, tokenId, fungibilizerId);
    }

    /// @inheritdoc IFungibilityEngine
    function defunge(address collection) external override nonReentrant {
        address pool = _pools[collection];
        if (pool == address(0)) revert PoolDoesNotExist();

        uint256 vaultSize = _vaults[collection].length;
        if (vaultSize == 0) revert VaultEmpty();

        // Pseudo-random selection using prevrandao
        uint256 index = uint256(
            keccak256(abi.encodePacked(block.prevrandao, msg.sender, block.timestamp))
        ) % vaultSize;

        uint256 selectedTokenId = _vaults[collection][index];

        // Effects: remove from vault using swap-and-pop
        uint256 lastTokenId = _vaults[collection][vaultSize - 1];
        _vaults[collection][index] = lastTokenId;
        _vaultIndex[collection][lastTokenId] = index + 1;
        _vaults[collection].pop();
        delete _vaultIndex[collection][selectedTokenId];

        // Interactions
        PoolToken(pool).burn(msg.sender, alpha);
        IERC721(collection).transferFrom(address(this), msg.sender, selectedTokenId);

        emit Defunged(msg.sender, collection, selectedTokenId);
    }

    // ──────────────────────────────────────────────
    // View functions
    // ──────────────────────────────────────────────

    /// @inheritdoc IFungibilityEngine
    function getPool(address collection) external view override returns (address) {
        return _pools[collection];
    }

    /// @inheritdoc IFungibilityEngine
    function getVaultSize(address collection) external view override returns (uint256) {
        return _vaults[collection].length;
    }

    /// @inheritdoc IFungibilityEngine
    function getVaultContents(address collection) external view override returns (uint256[] memory) {
        return _vaults[collection];
    }
}
