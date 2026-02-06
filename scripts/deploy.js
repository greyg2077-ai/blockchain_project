const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("=".repeat(60));
    console.log("EduFund Platform Deployment");
    console.log("=".repeat(60));

    const [deployer] = await hre.ethers.getSigners();
    console.log("\n📍 Deploying contracts with account:", deployer.address);

    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log("💰 Account balance:", hre.ethers.formatEther(balance), "ETH");

    // ============ Deploy EduToken ============
    console.log("\n" + "-".repeat(40));
    console.log("Step 1: Deploying EduToken...");

    const EduToken = await hre.ethers.getContractFactory("EduToken");
    const eduToken = await EduToken.deploy(deployer.address);
    await eduToken.waitForDeployment();

    const eduTokenAddress = await eduToken.getAddress();
    console.log("✅ EduToken deployed to:", eduTokenAddress);
    console.log("   Name:", await eduToken.name());
    console.log("   Symbol:", await eduToken.symbol());
    console.log("   Initial Owner:", await eduToken.owner());

    // ============ Deploy EduFund ============
    console.log("\n" + "-".repeat(40));
    console.log("Step 2: Deploying EduFund...");

    const EduFund = await hre.ethers.getContractFactory("EduFund");
    const eduFund = await EduFund.deploy(eduTokenAddress);
    await eduFund.waitForDeployment();

    const eduFundAddress = await eduFund.getAddress();
    console.log("✅ EduFund deployed to:", eduFundAddress);
    console.log("   EduToken Reference:", await eduFund.eduToken());
    console.log("   Reward Rate:", (await eduFund.REWARD_RATE()).toString(), "EDU per ETH");

    // ============ Transfer Ownership ============
    console.log("\n" + "-".repeat(40));
    console.log("Step 3: Transferring EduToken ownership to EduFund...");

    const transferTx = await eduToken.transferOwnership(eduFundAddress);
    await transferTx.wait();

    const newOwner = await eduToken.owner();
    console.log("✅ Ownership transferred!");
    console.log("   New EduToken Owner:", newOwner);

    if (newOwner.toLowerCase() === eduFundAddress.toLowerCase()) {
        console.log("   ✓ Verified: EduFund can now mint EDU tokens");
    } else {
        console.error("   ✗ ERROR: Ownership transfer failed!");
        process.exit(1);
    }

    // ============ Save Contract Artifacts for Frontend ============
    console.log("\n" + "-".repeat(40));
    console.log("Step 4: Saving contract artifacts for frontend...");

    const frontendDir = path.join(__dirname, "..", "frontend", "src", "contracts");

    // Create contracts directory if it doesn't exist
    if (!fs.existsSync(frontendDir)) {
        fs.mkdirSync(frontendDir, { recursive: true });
    }

    // Get ABIs from artifacts
    const eduTokenArtifact = await hre.artifacts.readArtifact("EduToken");
    const eduFundArtifact = await hre.artifacts.readArtifact("EduFund");

    // Create deployment info object
    const deploymentInfo = {
        network: hre.network.name,
        chainId: hre.network.config.chainId || 31337,
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
        contracts: {
            EduToken: {
                address: eduTokenAddress,
                abi: eduTokenArtifact.abi
            },
            EduFund: {
                address: eduFundAddress,
                abi: eduFundArtifact.abi
            }
        }
    };

    // Save to frontend
    const deploymentPath = path.join(frontendDir, "deployment.json");
    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
    console.log("✅ Deployment info saved to:", deploymentPath);

    // Also save individual contract files for easier imports
    fs.writeFileSync(
        path.join(frontendDir, "EduToken.json"),
        JSON.stringify({ address: eduTokenAddress, abi: eduTokenArtifact.abi }, null, 2)
    );
    fs.writeFileSync(
        path.join(frontendDir, "EduFund.json"),
        JSON.stringify({ address: eduFundAddress, abi: eduFundArtifact.abi }, null, 2)
    );
    console.log("✅ Individual contract files saved");

    // ============ Deployment Summary ============
    console.log("\n" + "=".repeat(60));
    console.log("DEPLOYMENT COMPLETE!");
    console.log("=".repeat(60));
    console.log("\n📋 Contract Addresses:");
    console.log("   EduToken:", eduTokenAddress);
    console.log("   EduFund:", eduFundAddress);
    console.log("\n🔐 Access Control:");
    console.log("   EduToken Owner: EduFund contract");
    console.log("   (Only EduFund can mint EDU tokens)");
    console.log("\n📁 Frontend artifacts saved to:");
    console.log("   ", frontendDir);
    console.log("\n🚀 Next Steps:");
    console.log("   1. Start the Hardhat node: npx hardhat node");
    console.log("   2. Run this deploy script: npx hardhat run scripts/deploy.js --network localhost");
    console.log("   3. Start the frontend: cd frontend && npm run dev");
    console.log("=".repeat(60));

    return { eduToken, eduFund, eduTokenAddress, eduFundAddress };
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Deployment failed!");
        console.error(error);
        process.exit(1);
    });
