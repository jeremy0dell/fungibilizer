// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IFungibilizer.sol";

/// @title Fungibilizer
/// @notice Scarce, consumable ERC-721 token that grants the power to fung one NFT.
///         Each Fungibilizer can be used exactly once, after which it is permanently burned.
contract Fungibilizer is ERC721, Ownable, IFungibilizer {
    uint256 private _nextTokenId;
    uint256 private _totalConsumed;

    address private _engine;
    bool private _engineSet;

    error EngineAlreadySet();
    error EngineNotSet();
    error OnlyEngine();
    error TokenDoesNotExist();

    constructor(address owner_) ERC721("Fungibilizer", "FUNG") Ownable(owner_) {}

    // ──────────────────────────────────────────────
    // Admin: one-time engine registration
    // ──────────────────────────────────────────────

    /// @notice Set the FungibilityEngine address. Can only be called once.
    function setEngine(address engine_) external onlyOwner {
        if (_engineSet) revert EngineAlreadySet();
        _engine = engine_;
        _engineSet = true;
    }

    // ──────────────────────────────────────────────
    // Minting
    // ──────────────────────────────────────────────

    /// @notice Mint new Fungibilizer tokens. Only callable by the owner.
    /// @param to Recipient address
    /// @param amount Number of Fungibilizers to mint
    function mint(address to, uint256 amount) external onlyOwner {
        for (uint256 i = 0; i < amount; i++) {
            _safeMint(to, _nextTokenId);
            _nextTokenId++;
        }
    }

    // ──────────────────────────────────────────────
    // Consumption (called by Engine during funge)
    // ──────────────────────────────────────────────

    /// @inheritdoc IFungibilizer
    function consume(uint256 tokenId) external override {
        if (!_engineSet) revert EngineNotSet();
        if (msg.sender != _engine) revert OnlyEngine();
        if (_ownerOf(tokenId) == address(0)) revert TokenDoesNotExist();

        _burn(tokenId);
        _totalConsumed++;
    }

    // ──────────────────────────────────────────────
    // View functions
    // ──────────────────────────────────────────────

    /// @inheritdoc IFungibilizer
    function engine() external view override returns (address) {
        return _engine;
    }

    /// @inheritdoc IFungibilizer
    function totalMinted() external view override returns (uint256) {
        return _nextTokenId;
    }

    /// @inheritdoc IFungibilizer
    function totalConsumed() external view override returns (uint256) {
        return _totalConsumed;
    }

    /// @inheritdoc IFungibilizer
    function remainingSupply() external view override returns (uint256) {
        return _nextTokenId - _totalConsumed;
    }
}
