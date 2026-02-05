// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./EduToken.sol";

/**
 * @title EduFund
 * @dev Main Crowdfunding Contract for educational campaigns
 * @notice Allows users to create campaigns, donate ETH, and earn EDU tokens
 * 
 * Features:
 * - Create campaigns with title, goal, and duration
 * - Donate ETH to campaigns and receive EDU tokens (1 ETH = 100 EDU)
 * - Campaign owners can withdraw funds after deadline if goal is met
 */
contract EduFund {
    

    
    /// @dev Reference to the EduToken contract for minting rewards
    EduToken public eduToken;
    
    /// @dev Counter for campaign IDs
    uint256 public campaignCount;
    
    /// @dev Reward rate: tokens per ETH (100 EDU per 1 ETH)
    uint256 public constant REWARD_RATE = 100;
    
    
    /**
     * @dev Campaign structure containing all campaign data
     * @param owner Address of the campaign creator
     * @param title Title/description of the campaign
     * @param goal Target amount in wei to raise
     * @param deadline Timestamp after which withdrawals are allowed
     * @param amountCollected Total ETH donated to the campaign
     * @param finalized Whether funds have been withdrawn
     */
    struct Campaign {
        address owner;
        string title;
        string description;
        uint256 goal;
        uint256 deadline;
        uint256 amountCollected;
        bool finalized;
    }
    
    //Mappings
    
    /// @dev Mapping from campaign ID to Campaign struct
    mapping(uint256 => Campaign) public campaigns;
    
    /// @dev Mapping to track donations: campaignId => donor => amount
    mapping(uint256 => mapping(address => uint256)) public donations;
    
    //Events
    
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
    
    //Errors
    
    error CampaignDoesNotExist();
    error CampaignAlreadyFinalized();
    error DeadlineNotReached();
    error GoalNotReached();
    error NotCampaignOwner();
    error InvalidGoal();
    error InvalidDuration();
    error ZeroDonation();
    error TransferFailed();
    
    //Constructor
    
    /**
     * @dev Initializes the EduFund contract with EduToken reference
     * @param _eduToken Address of the deployed EduToken contract
     */
    constructor(address _eduToken) {
        eduToken = EduToken(_eduToken);
    }
    
    //External Functions
    
    /**
     * @dev Creates a new crowdfunding campaign
     * @param _title Title/description of the campaign
     * @param _description Description of the campaign
     * @param _goal Target amount to raise in wei
     * @param _duration Duration in seconds from now until deadline
     * @return campaignId The ID of the newly created campaign
     */
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
    
    /**
     * @dev Donate ETH to a campaign and receive EDU tokens
     * @param _id Campaign ID to donate to
     * 
     * Requirements:
     * - Campaign must exist
     * - Campaign must not be finalized
     * - Donation amount must be greater than 0
     * 
     * Rewards:
     * - 1 ETH = 100 EDU tokens (handled with 18 decimals)
     */
    function donate(uint256 _id) external payable {
        if (_id >= campaignCount) revert CampaignDoesNotExist();
        if (msg.value == 0) revert ZeroDonation();
        
        Campaign storage campaign = campaigns[_id];
        if (campaign.finalized) revert CampaignAlreadyFinalized();
        
        // Update campaign amount
        campaign.amountCollected += msg.value;
        
        // Track individual donation
        donations[_id][msg.sender] += msg.value;
        
        // Calculate and mint EDU reward tokens
        // 1 ETH = 100 EDU, both have 18 decimals
        // tokenAmount = ethAmount * 100
        uint256 tokenReward = msg.value * REWARD_RATE;
        eduToken.mint(msg.sender, tokenReward);
        
        emit DonationReceived(_id, msg.sender, msg.value, tokenReward);
        
        emit FundSent(msg.sender, _id, msg.value, block.timestamp);
    }
    
    /**
     * @dev Withdraw collected funds from a successful campaign
     * @param _id Campaign ID to withdraw from
     * 
     * Requirements:
     * - Caller must be the campaign owner
     * - Current time must be past the deadline
     * - Amount collected must meet or exceed the goal
     * - Campaign must not be already finalized
     */
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
    
    //View Functions
    
    /**
     * @dev Returns all details of a campaign
     * @param _id Campaign ID to query
     * @return owner Campaign creator address
     * @return title Campaign title
     * @return goal Target amount in wei
     * @return deadline Timestamp when campaign ends
     * @return amountCollected Total ETH collected
     * @return finalized Whether funds have been withdrawn
     */
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
    
    /**
     * @dev Returns all campaigns (for frontend listing)
     * @return allCampaigns Array of all campaigns
     */
    function getAllCampaigns() external view returns (Campaign[] memory) {
        Campaign[] memory allCampaigns = new Campaign[](campaignCount);
        for (uint256 i = 0; i < campaignCount; i++) {
            allCampaigns[i] = campaigns[i];
        }
        return allCampaigns;
    }
    
    /**
     * @dev Get donation amount for a donor in a specific campaign
     * @param _id Campaign ID
     * @param _donor Donor address
     * @return amount Donation amount in wei
     */
    function getDonation(uint256 _id, address _donor) external view returns (uint256) {
        return donations[_id][_donor];
    }
}

