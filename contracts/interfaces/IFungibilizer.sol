// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IFungibilizer {
    /// @notice Consume (burn) a Fungibilizer token. Only callable by the Engine.
    /// @param tokenId The Fungibilizer token to consume
    function consume(uint256 tokenId) external;

    /// @notice Returns the address authorized to consume Fungibilizers
    function engine() external view returns (address);

    /// @notice Returns the total number of Fungibilizers ever minted
    function totalMinted() external view returns (uint256);

    /// @notice Returns the number of Fungibilizers consumed (burned)
    function totalConsumed() external view returns (uint256);

    /// @notice Returns the number of unconsumed Fungibilizers remaining
    function remainingSupply() external view returns (uint256);
}
