// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IPoolToken is IERC20 {
    /// @notice Initialize the pool token (called once by proxy deployer)
    /// @param name_ Token name (e.g., "Fungibilized Bored Ape Yacht Club")
    /// @param symbol_ Token symbol (e.g., "fBAYC")
    /// @param engine_ Address of the FungibilityEngine
    function initialize(string memory name_, string memory symbol_, address engine_) external;

    /// @notice Mint pool tokens. Only callable by the Engine.
    /// @param to Recipient address
    /// @param amount Amount to mint (in wei, 1e18 = 1 pool token)
    function mint(address to, uint256 amount) external;

    /// @notice Burn pool tokens. Only callable by the Engine.
    /// @param from Address to burn from
    /// @param amount Amount to burn
    function burn(address from, uint256 amount) external;

    /// @notice Returns the NFT collection address this pool represents
    function collection() external view returns (address);
}
