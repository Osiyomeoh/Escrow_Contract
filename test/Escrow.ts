const { expect } = require("chai");
const { ethers } = require("hardhat");
import {
    time,
    loadFixture,
  } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("Escrow", function () {
  async function deployEscrowFixture() {
    const [owner, arbiter, depositor, beneficiary] = await ethers.getSigners();
    const Escrow = await ethers.getContractFactory("Escrow");
    const escrow = await Escrow.deploy(arbiter.address);
   

    return { escrow, owner, arbiter, depositor, beneficiary };
  }

  it("Should set the correct arbiter", async function () {
    const { escrow, arbiter } = await loadFixture(deployEscrowFixture);
    expect(await escrow.arbiter()).to.equal(arbiter.address);
  });

  it("Should create a deposit", async function () {
    const { escrow, depositor, beneficiary } = await loadFixture(deployEscrowFixture);
    const depositAmount = ethers.parseEther("1");
    await expect(escrow.connect(depositor).createDeposit(beneficiary.address, { value: depositAmount }))
      .to.emit(escrow, "DepositCreated")
      .withArgs(0, depositor.address, beneficiary.address, depositAmount);

    const deposit = await escrow.getDeposit(0);
    expect(deposit.depositor).to.equal(depositor.address);
    expect(deposit.beneficiary).to.equal(beneficiary.address);
    expect(deposit.amount).to.equal(depositAmount);
    expect(deposit.isApproved).to.be.false;
    expect(deposit.isWithdrawn).to.be.false;
    expect(deposit.requiredConditions).to.equal(0);
    expect(deposit.metConditions).to.equal(0);
  });

  it("Should set and meet conditions", async function () {
    const { escrow, arbiter, depositor, beneficiary } = await loadFixture(deployEscrowFixture);
    const depositAmount = ethers.parseEther("1");
    await escrow.connect(depositor).createDeposit(beneficiary.address, { value: depositAmount });

    const condition = ethers.keccak256(ethers.toUtf8Bytes("Condition 1"));
    
    await expect(escrow.connect(arbiter).setCondition(0, condition))
      .to.emit(escrow, "ConditionSet")
      .withArgs(0, condition);

    expect(await escrow.checkCondition(0, condition)).to.be.false;

    await expect(escrow.connect(arbiter).meetCondition(0, condition))
      .to.emit(escrow, "ConditionMet")
      .withArgs(0, condition)
      .to.emit(escrow, "Approved")
      .withArgs(0);

    expect(await escrow.checkCondition(0, condition)).to.be.true;
  });

  it("Should not allow non-arbiter to set or meet conditions", async function () {
    const { escrow, depositor, beneficiary } = await loadFixture(deployEscrowFixture);
    await escrow.connect(depositor).createDeposit(beneficiary.address, { value: ethers.parseEther("1") });
    const condition = ethers.keccak256(ethers.toUtf8Bytes("Condition 1"));

    await expect(escrow.connect(depositor).setCondition(0, condition)).to.be.revertedWith("Only arbiter can set conditions");
    await expect(escrow.connect(beneficiary).meetCondition(0, condition)).to.be.revertedWith("Only arbiter can meet conditions");
  });

  it("Should allow withdrawal after approval", async function () {
    const { escrow, arbiter, depositor, beneficiary } = await loadFixture(deployEscrowFixture);
    const depositAmount = ethers.parseEther("1");
    await escrow.connect(depositor).createDeposit(beneficiary.address, { value: depositAmount });

    const condition = ethers.keccak256(ethers.toUtf8Bytes("Condition 1"));
    await escrow.connect(arbiter).setCondition(0, condition);
    await escrow.connect(arbiter).meetCondition(0, condition);

    await expect(escrow.connect(beneficiary).withdraw(0))
      .to.emit(escrow, "Withdrawn")
      .withArgs(0, depositAmount);

    const deposit = await escrow.getDeposit(0);
    expect(deposit.isWithdrawn).to.be.true;
  });

  it("Should not allow withdrawal before approval", async function () {
    const { escrow, depositor, beneficiary } = await loadFixture(deployEscrowFixture);
    await escrow.connect(depositor).createDeposit(beneficiary.address, { value: ethers.parseEther("1") });
    await expect(escrow.connect(beneficiary).withdraw(0)).to.be.revertedWith("Not yet approved");
  });

  it("Should not allow double withdrawal", async function () {
    const { escrow, arbiter, depositor, beneficiary } = await loadFixture(deployEscrowFixture);
    const depositAmount = ethers.parseEther("1");
    await escrow.connect(depositor).createDeposit(beneficiary.address, { value: depositAmount });

    const condition = ethers.keccak256(ethers.toUtf8Bytes("Condition 1"));
    await escrow.connect(arbiter).setCondition(0, condition);
    await escrow.connect(arbiter).meetCondition(0, condition);

    await escrow.connect(beneficiary).withdraw(0);
    await expect(escrow.connect(beneficiary).withdraw(0)).to.be.revertedWith("Already withdrawn");
  });
});