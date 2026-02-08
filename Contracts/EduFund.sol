// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./EduToken.sol";

contract EduFund {
    
    EduToken public eduToken;
    uint256 public campaignCount;
    uint256 public constant REWARD_RATE = 100;
    
    struct Campaign {
        address owner;
        string title;
        string description;
        uint256 goal;
        uint256 deadline;
        uint256 amountCollected;
        bool finalized;
    }
    
    mapping(uint256 => Campaign) public campaigns;
    mapping(uint256 => mapping(address => uint256)) public donations;
    
    event CampaignCreated(
        uint256 indexed campaignId,
        address indexed owner,
        string title,
        uint256 goal,
        uint256 deadline
    );
    
    event DonationReceived(
        uint256 indexed campaignId,
        address indexed donor,
        uint256 amount,
        uint256 tokensRewarded
    );
    
    event FundsWithdrawn(
        uint256 indexed campaignId,
        address indexed owner,
        uint256 amount
    );
    
    event FundSent(
        address indexed funder,
        uint256 indexed campaignId,
        uint256 amount,
        uint256 timestamp
    );
    
    error CampaignDoesNotExist();
    error CampaignAlreadyFinalized();
    error DeadlineNotReached();
    error GoalNotReached();
    error NotCampaignOwner();
    error InvalidGoal();
    error InvalidDuration();
    error ZeroDonation();
    error TransferFailed();
    error CampaignStillActive();
    
    constructor(address _eduToken) {
        eduToken = EduToken(_eduToken);
    }
    
    function createCampaign(
        string calldata _title,
        string calldata _description,
        uint256 _goal,
        uint256 _duration
    ) external returns (uint256) {
        if (_goal == 0) revert InvalidGoal();
        if (_duration == 0) revert InvalidDuration();
        
        uint256 campaignId = campaignCount;
        campaignCount++;
        
        campaigns[campaignId] = Campaign({
            owner: msg.sender,
            title: _title,
            description: _description,
            goal: _goal,
            deadline: block.timestamp + _duration,
            amountCollected: 0,
            finalized: false
        });
        
        emit CampaignCreated(
            campaignId,
            msg.sender,
            _title,
            _goal,
            block.timestamp + _duration
        );
        
        return campaignId;
    }
    
    function donate(uint256 _id) external payable {
        if (_id >= campaignCount) revert CampaignDoesNotExist();
        if (msg.value == 0) revert ZeroDonation();
        
        Campaign storage campaign = campaigns[_id];
        if (campaign.finalized) revert CampaignAlreadyFinalized();
        
        // Update campaign amount
        campaign.amountCollected += msg.value;
        
        // Track individual donation
        donations[_id][msg.sender] += msg.value;
        
        // 1 ETH = 100 EDU
        uint256 tokenReward = msg.value * REWARD_RATE;
        eduToken.mint(msg.sender, tokenReward);
        
        emit DonationReceived(_id, msg.sender, msg.value, tokenReward);
        
        emit FundSent(msg.sender, _id, msg.value, block.timestamp);
    }
    
    function withdraw(uint256 _id) external {
        if (_id >= campaignCount) revert CampaignDoesNotExist();
        
        Campaign storage campaign = campaigns[_id];
        
        if (msg.sender != campaign.owner) revert NotCampaignOwner();
        if (block.timestamp < campaign.deadline) revert DeadlineNotReached();
        if (campaign.amountCollected < campaign.goal) revert GoalNotReached();
        if (campaign.finalized) revert CampaignAlreadyFinalized();
        
        // Mark as finalized before transfer (reentrancy protection)
        campaign.finalized = true;
        
        uint256 amount = campaign.amountCollected;
        
        // Transfer funds to campaign owner
        (bool success, ) = payable(campaign.owner).call{value: amount}("");
        if (!success) revert TransferFailed();
        
        emit FundsWithdrawn(_id, campaign.owner, amount);
    }
    
    function refund(uint256 _id) external {
        Campaign storage campaign = campaigns[_id];
        
        if (block.timestamp < campaign.deadline) revert CampaignStillActive();
        if (campaign.amountCollected >= campaign.goal) revert GoalNotReached(); 
        
        uint256 donatedAmount = donations[_id][msg.sender];
        if (donatedAmount == 0) revert ZeroDonation();
        
        // Reset donation to prevent re-entrancy
        donations[_id][msg.sender] = 0;
        
        (bool success, ) = payable(msg.sender).call{value: donatedAmount}("");
        if (!success) revert TransferFailed();
    }

    function getCampaign(uint256 _id) external view returns (
        address owner,
        string memory title,
        string memory description,
        uint256 goal,
        uint256 deadline,
        uint256 amountCollected,
        bool finalized
    ) {
        if (_id >= campaignCount) revert CampaignDoesNotExist();
        
        Campaign storage campaign = campaigns[_id];
        return (
            campaign.owner,
            campaign.title,
            campaign.description,
            campaign.goal,
            campaign.deadline,
            campaign.amountCollected,
            campaign.finalized
        );
    }
    
    function getAllCampaigns() external view returns (Campaign[] memory) {
        Campaign[] memory allCampaigns = new Campaign[](campaignCount);
        for (uint256 i = 0; i < campaignCount; i++) {
            allCampaigns[i] = campaigns[i];
        }
        return allCampaigns;
    }
    
    function getDonation(uint256 _id, address _donor) external view returns (uint256) {
        return donations[_id][_donor];
    }
}
