// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IFungibilityEngine {
    /// @notice Funge an NFT: burn a Fungibilizer, vault the NFT, mint pool tokens
    /// @param fungibilizerId The Fungibilizer token to consume
    /// @param collection The ERC-721 collection address
    /// @param tokenId The NFT token ID to funge
    function funge(uint256 fungibilizerId, address collection, uint256 tokenId) external;

    /// @notice Defunge: burn pool tokens, receive a random NFT from the vault
    /// @param collection The ERC-721 collection to defunge from
    function defunge(address collection) external;

    /// @notice Pre-deploy a pool for a collection (optional gas optimization)
    /// @param collection The ERC-721 collection address
    /// @param name Pool token name
    /// @param symbol Pool token symbol
    function createPool(address collection, string memory name, string memory symbol) external;

    /// @notice Returns the pool token address for a collection (address(0) if none)
    function getPool(address collection) external view returns (address);

    /// @notice Returns the number of NFTs vaulted for a collection
    function getVaultSize(address collection) external view returns (uint256);

    /// @notice Returns the NFT token IDs in a collection's vault
    function getVaultContents(address collection) external view returns (uint256[] memory);

    /// @notice The fungible token mint amount per NFT (α), in wei
    function alpha() external view returns (uint256);

    event PoolCreated(address indexed collection, address poolToken);
    event Funged(address indexed user, address indexed collection, uint256 nftId, uint256 fungibilizerId);
    event Defunged(address indexed user, address indexed collection, uint256 nftId);
}
