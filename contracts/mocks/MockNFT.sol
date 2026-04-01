// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/// @title MockNFT
/// @notice A simple ERC-721 for testing. Anyone can mint.
contract MockNFT is ERC721 {
    uint256 private _nextTokenId;

    constructor(string memory name_, string memory symbol_) ERC721(name_, symbol_) {}

    function mint(address to) external returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _mint(to, tokenId);
        return tokenId;
    }

    function mintBatch(address to, uint256 amount) external returns (uint256[] memory) {
        uint256[] memory ids = new uint256[](amount);
        for (uint256 i = 0; i < amount; i++) {
            ids[i] = _nextTokenId++;
            _mint(to, ids[i]);
        }
        return ids;
    }
}
