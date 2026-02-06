const CONTRACT_CONFIG = {
  // These will be updated after running deploy.js
  EDUFUND_ADDRESS: "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
  EDUTOKEN_ADDRESS: "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",

  // ABIs - Minimal interfaces needed
  EDUFUND_ABI: [
    "function campaignCount() view returns (uint256)",
    "function campaigns(uint256) view returns (address owner, string title, string description, uint256 goal, uint256 deadline, uint256 amountCollected, bool finalized)",
    "function createCampaign(string calldata _title, string calldata _description, uint256 _goal, uint256 _duration) returns (uint256)",
    "function donate(uint256 _id) payable",
    "function withdraw(uint256 _id)",
    "function getCampaign(uint256 _id) view returns (address owner, string title, string description, uint256 goal, uint256 deadline, uint256 amountCollected, bool finalized)",
    "function getAllCampaigns() view returns (tuple(address owner, string title, string description, uint256 goal, uint256 deadline, uint256 amountCollected, bool finalized)[])",
    "function getDonation(uint256 _id, address _donor) view returns (uint256)",
    "event CampaignCreated(uint256 indexed campaignId, address indexed owner, string title, uint256 goal, uint256 deadline)",
    "event DonationReceived(uint256 indexed campaignId, address indexed donor, uint256 amount, uint256 tokensRewarded)",
    "event FundsWithdrawn(uint256 indexed campaignId, address indexed owner, uint256 amount)",
    "event FundSent(address indexed funder, uint256 indexed campaignId, uint256 amount, uint256 timestamp)"
  ],

  EDUTOKEN_ABI: [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address account) view returns (uint256)"
  ]
};

// Application State
let state = {
  provider: null,
  signer: null,
  account: null,
  chainId: null,
  eduFundContract: null,
  eduTokenContract: null,
  campaigns: [],
  isConnected: false
};

// DOM Elements
const elements = {
  connectBtn: document.getElementById("connectBtn"),
  walletInfo: document.getElementById("walletInfo"),
  walletAddress: document.getElementById("walletAddress"),
  networkBadge: document.getElementById("networkBadge"),
  networkName: document.getElementById("networkName"),
  dashboard: document.getElementById("dashboard"),
  createSection: document.getElementById("createSection"),
  campaignsSection: document.getElementById("campaignsSection"),
  campaignsGrid: document.getElementById("campaignsGrid"),
  ethBalance: document.getElementById("ethBalance"),
  eduBalance: document.getElementById("eduBalance"),
  totalCampaigns: document.getElementById("totalCampaigns"),
  createForm: document.getElementById("createForm"),
  toast: document.getElementById("toast"),
  toastMessage: document.getElementById("toastMessage"),
  loadingOverlay: document.getElementById("loadingOverlay"),
  toastMessage: document.getElementById("toastMessage"),
  loadingOverlay: document.getElementById("loadingOverlay"),
  loadingText: document.getElementById("loadingText"),
  historySection: document.getElementById("historySection"),
  historyList: document.getElementById("historyList")
};

// Initialization
document.addEventListener("DOMContentLoaded", () => {
  initializeApp();
});

async function initializeApp() {
  // Event Listeners
  elements.connectBtn.addEventListener("click", connectWallet);
  elements.createForm.addEventListener("submit", handleCreateCampaign);

  // Check if already connected
  if (window.ethereum) {
    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    // Check for existing connection
    const accounts = await window.ethereum.request({ method: "eth_accounts" });
    if (accounts.length > 0) {
      await connectWallet();
    }
  }

  // Load campaigns without wallet (read-only)
  await loadCampaignsReadOnly();
}

// Wallet Connection
async function connectWallet() {
  if (!window.ethereum) {
    showToast("Please install MetaMask!", "error");
    return;
  }

  try {
    showLoading("Connecting to MetaMask...");

    // Request accounts
    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts"
    });

    // Setup ethers provider and signer
    state.provider = new ethers.BrowserProvider(window.ethereum);
    state.signer = await state.provider.getSigner();
    state.account = accounts[0];
    state.chainId = await window.ethereum.request({ method: "eth_chainId" });

    // Initialize contracts
    await initializeContracts();

    // Update UI
    state.isConnected = true;
    updateWalletUI();
    await refreshData();

    hideLoading();
    showToast("Wallet connected successfully!", "success");

  } catch (error) {
    hideLoading();
    console.error("Connection error:", error);
    showToast("Failed to connect wallet", "error");
  }
}

async function initializeContracts() {
  state.eduFundContract = new ethers.Contract(
    CONTRACT_CONFIG.EDUFUND_ADDRESS,
    CONTRACT_CONFIG.EDUFUND_ABI,
    state.signer
  );

  state.eduTokenContract = new ethers.Contract(
    CONTRACT_CONFIG.EDUTOKEN_ADDRESS,
    CONTRACT_CONFIG.EDUTOKEN_ABI,
    state.signer
  );
}

function handleAccountsChanged(accounts) {
  if (accounts.length === 0) {
    disconnectWallet();
  } else {
    state.account = accounts[0];
    updateWalletUI();
    refreshData();
  }
}

function handleChainChanged() {
  window.location.reload();
}

function disconnectWallet() {
  state.isConnected = false;
  state.account = null;
  state.signer = null;

  elements.connectBtn.classList.remove("hidden");
  elements.walletInfo.classList.add("hidden");
  elements.networkBadge.classList.add("hidden");
  elements.dashboard.classList.add("hidden");
  elements.createSection.classList.add("hidden");
}

function updateWalletUI() {
  if (state.isConnected) {
    elements.connectBtn.classList.add("hidden");
    elements.walletInfo.classList.remove("hidden");
    elements.networkBadge.classList.remove("hidden");
    elements.dashboard.classList.remove("hidden");
    elements.createSection.classList.remove("hidden");
    elements.historySection.classList.remove("hidden");

    // Format address
    const addr = state.account;
    elements.walletAddress.textContent = `${addr.slice(0, 6)}...${addr.slice(-4)}`;

    // Network name
    const networkNames = {
      "0x1": "Ethereum",
      "0x7a69": "Hardhat",
      "0x539": "Localhost"
    };
    elements.networkName.textContent = networkNames[state.chainId] || `Chain ${parseInt(state.chainId, 16)}`;
  }
}

// Data Loading
async function refreshData() {
  await Promise.all([
    loadBalances(),
    loadBalances(),
    loadCampaigns(),
    loadTransactionHistory()
  ]);
}

async function loadBalances() {
  if (!state.isConnected) return;

  try {
    // ETH Balance
    const ethBalance = await state.provider.getBalance(state.account);
    elements.ethBalance.textContent = parseFloat(ethers.formatEther(ethBalance)).toFixed(4);

    // EDU Token Balance
    const eduBalance = await state.eduTokenContract.balanceOf(state.account);
    elements.eduBalance.textContent = parseFloat(ethers.formatEther(eduBalance)).toFixed(2);

  } catch (error) {
    console.error("Error loading balances:", error);
  }
}

async function loadCampaignsReadOnly() {
  try {
    const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
    const contract = new ethers.Contract(
      CONTRACT_CONFIG.EDUFUND_ADDRESS,
      CONTRACT_CONFIG.EDUFUND_ABI,
      provider
    );

    const count = await contract.campaignCount();
    if (count > 0n) {
      const campaigns = await contract.getAllCampaigns();
      state.campaigns = campaigns;
      renderCampaigns();
      elements.totalCampaigns.textContent = campaigns.length;
    }
  } catch (error) {
    console.log("No local node running or no campaigns yet");
  }
}

async function loadCampaigns() {
  if (!state.isConnected) return;

  try {
    const count = await state.eduFundContract.campaignCount();
    elements.totalCampaigns.textContent = count.toString();

    if (count > 0n) {
      const campaigns = await state.eduFundContract.getAllCampaigns();
      state.campaigns = campaigns;
      renderCampaigns();
    } else {
      renderEmptyCampaigns();
    }

  } catch (error) {
    console.error("Error loading campaigns:", error);
  }
}

// Campaign Rendering
function renderCampaigns() {
  if (state.campaigns.length === 0) {
    renderEmptyCampaigns();
    return;
  }

  const now = BigInt(Math.floor(Date.now() / 1000));

  elements.campaignsGrid.innerHTML = state.campaigns.map((campaign, index) => {
    const goal = campaign.goal;
    const collected = campaign.amountCollected;
    const progress = goal > 0n ? Number((collected * 100n) / goal) : 0;
    const deadline = campaign.deadline;
    const isExpired = now >= deadline;
    const isSuccess = collected >= goal && isExpired;
    const isOwner = state.account && campaign.owner.toLowerCase() === state.account.toLowerCase();

    let badgeClass = "badge-active";
    let badgeText = "Active";

    if (campaign.finalized) {
      badgeClass = "badge-success";
      badgeText = "Completed";
    } else if (isExpired) {
      if (collected >= goal) {
        badgeClass = "badge-success";
        badgeText = "Goal Met";
      } else {
        badgeClass = "badge-ended";
        badgeText = "Ended";
      }
    }

    const deadlineDate = new Date(Number(deadline) * 1000);
    const timeLeft = getTimeLeft(deadline);

    return `
      <div class="campaign-card" data-id="${index}">
        <div class="campaign-header">
          <h3 class="campaign-title">${escapeHtml(campaign.title)}</h3>
          <span class="campaign-badge ${badgeClass}">${badgeText}</span>
        </div>
        
        <p class="campaign-description">${escapeHtml(campaign.description)}</p>
        <p class="campaign-owner">by ${campaign.owner.slice(0, 6)}...${campaign.owner.slice(-4)}</p>
        
        <div class="progress-section">
          <div class="progress-info">
            <span class="progress-raised">${parseFloat(ethers.formatEther(collected)).toFixed(4)} ETH</span>
            <span class="progress-goal">of ${parseFloat(ethers.formatEther(goal)).toFixed(2)} ETH</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${Math.min(progress, 100)}%"></div>
          </div>
          <p class="progress-percentage">${progress}%</p>
        </div>
        
        <p class="campaign-deadline">
          <span>⏰</span>
          <span>${isExpired ? "Ended" : timeLeft}</span>
        </p>
        
        <div class="campaign-actions">
          ${!campaign.finalized && !isExpired ? `
            <div class="donate-input-group">
              <input type="number" class="donate-input" 
                     placeholder="ETH amount" 
                     step="0.01" min="0.001" 
                     id="donate-${index}">
              <button class="btn btn-primary" onclick="donateToCampaign(${index})">
                Donate
              </button>
            </div>
          ` : ""}
          
          ${isOwner && isSuccess && !campaign.finalized ? `
            <button class="btn btn-success" onclick="withdrawFromCampaign(${index})">
              <span>💰</span>
              Withdraw Funds
            </button>
          ` : ""}
        </div>
      </div>
    `;
  }).join("");
}

function renderEmptyCampaigns() {
  elements.campaignsGrid.innerHTML = `
    <div class="empty-state">
      <span class="empty-icon">📚</span>
      <p>No campaigns yet. ${state.isConnected ? "Create the first one!" : "Connect your wallet to create one!"}</p>
    </div>
  `;
}

function getTimeLeft(deadline) {
  const now = BigInt(Math.floor(Date.now() / 1000));
  const remaining = deadline - now;

  if (remaining <= 0n) return "Ended";

  const days = remaining / 86400n;
  const hours = (remaining % 86400n) / 3600n;

  if (days > 0n) {
    return `${days}d ${hours}h left`;
  } else {
    const minutes = (remaining % 3600n) / 60n;
    return `${hours}h ${minutes}m left`;
  }
}

// Campaign Actions
async function handleCreateCampaign(e) {
  e.preventDefault();

  if (!state.isConnected) {
    showToast("Please connect your wallet first", "error");
    return;
  }

  const title = document.getElementById("campaignTitle").value.trim();
  const description = document.getElementById("campaignDescription").value.trim();
  const goal = document.getElementById("campaignGoal").value;
  const duration = document.getElementById("campaignDuration").value;

  if (!title || !description || !goal || !duration) {
    showToast("Please fill all fields", "error");
    return;
  }

  try {
    showLoading("Creating campaign...");

    const goalInWei = ethers.parseEther(goal);
    const durationInSeconds = parseInt(duration) * 24 * 60 * 60; // Days to seconds

    const tx = await state.eduFundContract.createCampaign(
      title,
      description,
      goalInWei,
      durationInSeconds
    );

    showLoading("Waiting for confirmation...");
    await tx.wait();

    // Reset form
    elements.createForm.reset();

    // Refresh data
    await refreshData();

    hideLoading();
    showToast("Campaign created successfully!", "success");

  } catch (error) {
    hideLoading();
    console.error("Create campaign error:", error);
    showToast(parseError(error), "error");
  }
}

async function donateToCampaign(campaignId) {
  if (!state.isConnected) {
    showToast("Please connect your wallet first", "error");
    return;
  }

  const input = document.getElementById(`donate-${campaignId}`);
  const amount = input?.value;

  if (!amount || parseFloat(amount) <= 0) {
    showToast("Please enter a valid amount", "error");
    return;
  }

  try {
    showLoading("Processing donation...");

    const amountInWei = ethers.parseEther(amount);

    const tx = await state.eduFundContract.donate(campaignId, {
      value: amountInWei
    });

    showLoading("Waiting for confirmation...");
    await tx.wait();

    // Clear input
    if (input) input.value = "";

    // Refresh data
    await refreshData();

    const eduReward = parseFloat(amount) * 100;
    hideLoading();
    showToast(`Donated ${amount} ETH! You received ${eduReward} EDU tokens!`, "success");

    // Refresh history immediately
    loadTransactionHistory();

  } catch (error) {
    hideLoading();
    console.error("Donation error:", error);
    showToast(parseError(error), "error");
  }
}

async function withdrawFromCampaign(campaignId) {
  if (!state.isConnected) {
    showToast("Please connect your wallet first", "error");
    return;
  }

  try {
    showLoading("Processing withdrawal...");

    const tx = await state.eduFundContract.withdraw(campaignId);

    showLoading("Waiting for confirmation...");
    await tx.wait();

    // Refresh data
    await refreshData();

    hideLoading();
    showToast("Funds withdrawn successfully!", "success");

  } catch (error) {
    hideLoading();
    console.error("Withdrawal error:", error);
    showToast(parseError(error), "error");
  }
}

async function loadTransactionHistory() {
  if (!state.isConnected) return;

  try {
    const historyList = elements.historyList;
    historyList.innerHTML = '<div class="loading-history">Loading history...</div>';

    // Query FundSent events
    // Filter: from block 0 to latest
    const filter = state.eduFundContract.filters.FundSent();
    const events = await state.eduFundContract.queryFilter(filter);

    if (events.length === 0) {
      historyList.innerHTML = '<div class="empty-history">No donations yet.</div>';
      return;
    }

    // Sort by block number (descending) - newest first
    events.sort((a, b) => b.blockNumber - a.blockNumber);

    // Take last 10 events
    const recentEvents = events.slice(0, 10);

    historyList.innerHTML = recentEvents.map(event => {
      const { funder, amount, timestamp } = event.args;
      const amountEth = ethers.formatEther(amount);
      const date = new Date(Number(timestamp) * 1000);
      const timeString = date.toLocaleString();

      // Calculate time ago
      const timeAgo = getTimeAgo(Number(timestamp));

      return `
        <div class="history-item">
          <div class="history-icon">💸</div>
          <div class="history-content">
            <span class="history-amount">${parseFloat(amountEth).toFixed(4)} ETH</span>
            <span class="history-funder">from ${funder.slice(0, 6)}...${funder.slice(-4)}</span>
          </div>
          <div class="history-time" title="${timeString}">${timeAgo}</div>
        </div>
      `;
    }).join("");

  } catch (error) {
    console.error("Error loading history:", error);
    elements.historyList.innerHTML = '<div class="error-history">Failed to load history</div>';
  }
}

function getTimeAgo(timestamp) {
  const seconds = Math.floor(Date.now() / 1000) - timestamp;

  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}


// Utility Functions

function showToast(message, type = "info") {
  elements.toastMessage.textContent = message;
  elements.toast.className = `toast ${type}`;
  elements.toast.classList.remove("hidden");
  elements.toast.classList.add("show");

  setTimeout(() => {
    elements.toast.classList.remove("show");
    setTimeout(() => {
      elements.toast.classList.add("hidden");
    }, 300);
  }, 4000);
}

function showLoading(text = "Processing...") {
  elements.loadingText.textContent = text;
  elements.loadingOverlay.classList.remove("hidden");
}

function hideLoading() {
  elements.loadingOverlay.classList.add("hidden");
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function parseError(error) {
  const message = error.message || error.toString();

  // Custom errors
  if (message.includes("CampaignDoesNotExist")) return "Campaign does not exist";
  if (message.includes("CampaignAlreadyFinalized")) return "Campaign already finalized";
  if (message.includes("DeadlineNotReached")) return "Deadline not yet reached";
  if (message.includes("GoalNotReached")) return "Campaign goal not reached";
  if (message.includes("NotCampaignOwner")) return "Only campaign owner can withdraw";
  if (message.includes("InvalidGoal")) return "Goal must be greater than 0";
  if (message.includes("InvalidDuration")) return "Duration must be greater than 0";
  if (message.includes("ZeroDonation")) return "Donation must be greater than 0";
  if (message.includes("user rejected")) return "Transaction rejected by user";
  if (message.includes("insufficient funds")) return "Insufficient funds";

  return "Transaction failed. Please try again.";
}
