// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title PoolToken
/// @notice Per-collection ERC-20 token backed 1:1 by vaulted NFTs.
///         Deployed as an EIP-1167 minimal proxy by the FungibilityEngine.
///         Each pool token represents fungibilized exposure to a specific NFT collection.
contract PoolToken is ERC20 {
    address private _engine;
    string private _name;
    string private _symbol;
    bool private _initialized;

    error AlreadyInitialized();
    error OnlyEngine();

    /// @dev Constructor sets empty name/symbol — real values come from initialize()
    constructor() ERC20("", "") {}

    /// @notice Initialize the pool token. Called once by the Engine after proxy deployment.
    /// @param name_ Token name (e.g., "Fungibilized Bored Ape Yacht Club")
    /// @param symbol_ Token symbol (e.g., "fBAYC")
    /// @param engine_ Address of the FungibilityEngine
    function initialize(string memory name_, string memory symbol_, address engine_) external {
        if (_initialized) revert AlreadyInitialized();
        _name = name_;
        _symbol = symbol_;
        _engine = engine_;
        _initialized = true;
    }

    /// @notice Mint pool tokens. Only callable by the Engine.
    function mint(address to, uint256 amount) external {
        if (msg.sender != _engine) revert OnlyEngine();
        _mint(to, amount);
    }

    /// @notice Burn pool tokens. Only callable by the Engine.
    function burn(address from, uint256 amount) external {
        if (msg.sender != _engine) revert OnlyEngine();
        _burn(from, amount);
    }

    /// @notice Returns the token name
    function name() public view override returns (string memory) {
        return _name;
    }

    /// @notice Returns the token symbol
    function symbol() public view override returns (string memory) {
        return _symbol;
    }
}
