const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("EduFund Short Test", function () {
    let eduToken, eduFund, owner, creator, donor;
    const GOAL = ethers.parseEther("10");
    const DURATION = 7 * 24 * 60 * 60;

    beforeEach(async function () {
        [owner, creator, donor] = await ethers.getSigners();
        const EduToken = await ethers.getContractFactory("EduToken");
        eduToken = await EduToken.deploy(owner.address);
        const EduFund = await ethers.getContractFactory("EduFund");
        eduFund = await EduFund.deploy(await eduToken.getAddress());
        await eduToken.transferOwnership(await eduFund.getAddress());
    });

    it("Should create campaign and track it", async function () {
        await eduFund.connect(creator).createCampaign("Title", "Desc", GOAL, DURATION);
        const campaign = await eduFund.getCampaign(0);
        expect(campaign.title).to.equal("Title");
        expect(await eduFund.campaignCount()).to.equal(1);
    });

    it("Should accept donation and mint ERC20 rewards", async function () {
        await eduFund.connect(creator).createCampaign("Title", "Desc", GOAL, DURATION);
        const donation = ethers.parseEther("1");

        // Тестируем (1 ETH = 100 EDU)
        await expect(eduFund.connect(donor).donate(0, { value: donation }))
            .to.emit(eduToken, "Transfer"); // Проверка выпуска токена

        expect(await eduToken.balanceOf(donor.address)).to.equal(donation * 100n);
        expect(await eduFund.getDonation(0, donor.address)).to.equal(donation);
    });

    it("Should allow withdrawal only if goal met and deadline passed", async function () {
        await eduFund.connect(creator).createCampaign("Title", "Desc", GOAL, DURATION);
        await eduFund.connect(donor).donate(0, { value: GOAL });

        await time.increase(DURATION + 1);

        const initialBal = await ethers.provider.getBalance(creator.address);
        await eduFund.connect(creator).withdraw(0);
        const finalBal = await ethers.provider.getBalance(creator.address);

        expect(finalBal).to.be.gt(initialBal); // Проверка получения ETH
        const campaign = await eduFund.getCampaign(0);
        expect(campaign.finalized).to.equal(true);
    });

    it("Should revert if non-owner tries to withdraw", async function () {
        await eduFund.connect(creator).createCampaign("Title", "Desc", GOAL, DURATION);
        await time.increase(DURATION + 1);
        await expect(eduFund.connect(donor).withdraw(0)).to.be.reverted;
    });
});