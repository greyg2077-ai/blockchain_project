// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title EduToken
 * @dev ERC-20 Reward Token for the EduFund platform
 * @notice Tokens are minted on-demand when users donate to campaigns
 * Token Name: "EduReward"
 * Token Symbol: "EDU"
 * Initial Supply: 0 (all tokens are minted via donations)
 * 
 * Access Control: Only the EduFund contract (owner) can mint tokens
 */
contract EduToken is ERC20, Ownable {
    
    /**
     * @dev Constructor - Initializes token with name and symbol
     * @param initialOwner The address that will initially own the contract
     * The ownership should be transferred to EduFund contract after deployment
     */
    constructor(address initialOwner) 
        ERC20("EduReward", "EDU") 
        Ownable(initialOwner) 
    {
        // No initial supply - tokens are minted on demand
    }

    /**
     * @dev Mints new tokens to a specified address
     * @param to The address that will receive the minted tokens
     * @param amount The amount of tokens to mint (in wei, 18 decimals)
     * 
     * Requirements:
     * - Caller must be the owner (EduFund contract)
     * 
     * @notice Used by EduFund to reward donors
     * Rate: 1 ETH donation = 100 EDU tokens
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
