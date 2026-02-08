# EduFund - Decentralized Education Crowdfunding
Hello! This is our final project for the Blockchain 1 course. EduFund is a DApp that helps people raise money for educational goals (like courses, books, or tuition) using the Ethereum network.

#The Idea
We wanted to create a transparent way for students to get support. When someone donates test ETH, they automatically receive our project's EDU tokens as a reward.

# Tech Stack
Blockchain: Solidity & Hardhat

Frontend: JavaScript , CSS

Library: Ethers.js

Wallet: MetaMask

Network: Hardhat Local network

# Features
Wallet Connection: Easy login with MetaMask integration.

Dashboard: Real-time display of your ETH and EDU token balances.

Create Campaign: Form to set a title, funding goal, and duration.

Campaign Cards: Visual progress bars showing how much is raised vs. the goal.

Automated Rewards: Supporters get 100 EDU tokens minted for every 1 ETH donated.

Secure Withdrawals: Campaign owners can withdraw funds only if the goal is reached.

   # Project Structure
contracts/:

EduFund.sol: Main logic for campaigns, donations, and refunds.

EduToken.sol: Our custom ERC-20 reward token.

frontend/:

index.html: The main UI.

app.js: Connects the website to the blockchain using Ethers.js.

config.js: Stores contract addresses (updated automatically after deploy).

scripts/:

deploy.js: Automation script to put our contracts on the network.

test/:

EduFund.test.js: 50+ lines of tests ensuring everything is secure.

start test:   npx hardhat test

   # Quick Start
1. Setup Environment
Bash
# Install dependencies
npm install
2. Local Development
Bash
# Start a local blockchain
npx hardhat node

# In a new terminal, deploy contracts
npx hardhat run scripts/deploy.js --network localhost

Open frontend/index.html using Live Server.


# Presentation
EduFund.pdf


# OUR team 
Kendebayev Nurassyl

Assylzhan Shalmanov

Makhmet Demesh
