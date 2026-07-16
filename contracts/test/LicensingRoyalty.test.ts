import { expect } from "chai";
import { ethers } from "hardhat";

describe("LicensingRoyalty", function () {
  const STUDENT_BPS = 1000; // 10%
  const UNIVERSITY_BPS = 500; // 5%
  const PRICE = ethers.parseEther("1.0");

  async function deploy() {
    const [, student, university, company, stranger] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("LicensingRoyalty");
    const contract = await Factory.deploy(
      student.address,
      university.address,
      company.address,
      STUDENT_BPS,
      UNIVERSITY_BPS,
      PRICE
    );
    await contract.waitForDeployment();
    return { contract, student, university, company, stranger };
  }

  it("derives companyBps as the remainder", async function () {
    const { contract } = await deploy();
    expect(await contract.companyBps()).to.equal(10000 - STUDENT_BPS - UNIVERSITY_BPS);
  });

  it("rejects deployment with bps summing over 100%", async function () {
    const [, student, university, company] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("LicensingRoyalty");
    await expect(
      Factory.deploy(student.address, university.address, company.address, 6000, 5000, PRICE)
    ).to.be.revertedWith("InnovChain: bps overflow");
  });

  it("only allows the company to fund, with the exact price", async function () {
    const { contract, company, stranger } = await deploy();

    await expect(contract.connect(stranger).fund({ value: PRICE })).to.be.revertedWith(
      "InnovChain: only licensee company may fund"
    );
    await expect(
      contract.connect(company).fund({ value: ethers.parseEther("0.5") })
    ).to.be.revertedWith("InnovChain: incorrect amount");

    await expect(contract.connect(company).fund({ value: PRICE }))
      .to.emit(contract, "Funded")
      .withArgs(company.address, PRICE);

    expect(await contract.funded()).to.equal(true);
  });

  it("blocks release before funding", async function () {
    const { contract, student } = await deploy();
    await expect(contract.connect(student).release()).to.be.revertedWith(
      "InnovChain: not funded"
    );
  });

  it("splits the balance 10% / 5% / 85% on release and pays all three parties", async function () {
    const { contract, student, university, company } = await deploy();
    await contract.connect(company).fund({ value: PRICE });

    const before = {
      student: await ethers.provider.getBalance(student.address),
      university: await ethers.provider.getBalance(university.address),
      company: await ethers.provider.getBalance(company.address),
    };

    const tx = await contract.connect(student).release();
    const receipt = await tx.wait();
    const gasCost = receipt!.gasUsed * receipt!.gasPrice;

    const expectedStudent = (PRICE * BigInt(STUDENT_BPS)) / 10000n;
    const expectedUniversity = (PRICE * BigInt(UNIVERSITY_BPS)) / 10000n;
    const expectedCompany = PRICE - expectedStudent - expectedUniversity;

    const after = {
      student: await ethers.provider.getBalance(student.address),
      university: await ethers.provider.getBalance(university.address),
      company: await ethers.provider.getBalance(company.address),
    };

    expect(after.university - before.university).to.equal(expectedUniversity);
    expect(after.company - before.company).to.equal(expectedCompany);
    // student paid the gas for this tx since they called release(), so net change is
    // the payout minus gas spent
    expect(after.student - before.student + gasCost).to.equal(expectedStudent);

    expect(await ethers.provider.getBalance(await contract.getAddress())).to.equal(0);
    expect(await contract.released()).to.equal(true);
  });

  it("cannot be released twice", async function () {
    const { contract, student, company } = await deploy();
    await contract.connect(company).fund({ value: PRICE });
    await contract.connect(student).release();
    await expect(contract.connect(student).release()).to.be.revertedWith(
      "InnovChain: already released"
    );
  });

  it("rejects funding twice", async function () {
    const { contract, company } = await deploy();
    await contract.connect(company).fund({ value: PRICE });
    await expect(contract.connect(company).fund({ value: PRICE })).to.be.revertedWith(
      "InnovChain: already funded"
    );
  });
});
