import { expect } from "chai";
import { ethers } from "hardhat";

describe("LicensingRoyalty", function () {
  const STUDENT_BPS = 1000; // 10% of the total license value
  const UNIVERSITY_BPS = 500; // 5% of the total license value
  // Only the student+university share is ever escrowed: for a 1 ETH license, that's
  // 0.15 ETH (10% + 5%). The company's remaining 85% never enters this contract.
  const ROYALTY_WEI = ethers.parseEther("0.15");

  async function deploy() {
    const [, student, university, company, stranger] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("LicensingRoyalty");
    const contract = await Factory.deploy(
      student.address,
      university.address,
      company.address,
      STUDENT_BPS,
      UNIVERSITY_BPS,
      ROYALTY_WEI
    );
    await contract.waitForDeployment();
    return { contract, student, university, company, stranger };
  }

  it("derives companyBps as the remainder (informational only)", async function () {
    const { contract } = await deploy();
    expect(await contract.companyBps()).to.equal(10000 - STUDENT_BPS - UNIVERSITY_BPS);
  });

  it("rejects deployment with bps summing over 100%", async function () {
    const [, student, university, company] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("LicensingRoyalty");
    await expect(
      Factory.deploy(student.address, university.address, company.address, 6000, 5000, ROYALTY_WEI)
    ).to.be.revertedWith("InnovChain: bps overflow");
  });

  it("rejects deployment with zero bps for both student and university", async function () {
    const [, student, university, company] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("LicensingRoyalty");
    await expect(
      Factory.deploy(student.address, university.address, company.address, 0, 0, ROYALTY_WEI)
    ).to.be.revertedWith("InnovChain: bps must be > 0");
  });

  it("only allows the company to fund, with the exact royalty amount", async function () {
    const { contract, company, stranger } = await deploy();

    await expect(contract.connect(stranger).fund({ value: ROYALTY_WEI })).to.be.revertedWith(
      "InnovChain: only licensee company may fund"
    );
    await expect(
      contract.connect(company).fund({ value: ethers.parseEther("0.05") })
    ).to.be.revertedWith("InnovChain: incorrect amount");

    await expect(contract.connect(company).fund({ value: ROYALTY_WEI }))
      .to.emit(contract, "Funded")
      .withArgs(company.address, ROYALTY_WEI);

    expect(await contract.funded()).to.equal(true);
  });

  it("blocks release before funding", async function () {
    const { contract, student } = await deploy();
    await expect(contract.connect(student).release()).to.be.revertedWith(
      "InnovChain: not funded"
    );
  });

  it("splits the escrowed royalty 10:5 between student and university, with no company payout", async function () {
    const { contract, student, university, company } = await deploy();
    await contract.connect(company).fund({ value: ROYALTY_WEI });

    const before = {
      student: await ethers.provider.getBalance(student.address),
      university: await ethers.provider.getBalance(university.address),
      company: await ethers.provider.getBalance(company.address),
    };

    const tx = await contract.connect(student).release();
    const receipt = await tx.wait();
    const gasCost = receipt!.gasUsed * receipt!.gasPrice;

    // Student:University split is 1000:500 = 2:1 of the escrowed royalty.
    const expectedStudent = (ROYALTY_WEI * BigInt(STUDENT_BPS)) / BigInt(STUDENT_BPS + UNIVERSITY_BPS);
    const expectedUniversity = ROYALTY_WEI - expectedStudent;

    const after = {
      student: await ethers.provider.getBalance(student.address),
      university: await ethers.provider.getBalance(university.address),
      company: await ethers.provider.getBalance(company.address),
    };

    expect(after.university - before.university).to.equal(expectedUniversity);
    // student paid the gas for this tx since they called release(), so net change is
    // the payout minus gas spent
    expect(after.student - before.student + gasCost).to.equal(expectedStudent);
    // the company never receives anything from this contract - its 85% share was never
    // escrowed in the first place
    expect(after.company - before.company).to.equal(0n);

    expect(await ethers.provider.getBalance(await contract.getAddress())).to.equal(0);
    expect(await contract.released()).to.equal(true);
  });

  it("cannot be released twice", async function () {
    const { contract, student, company } = await deploy();
    await contract.connect(company).fund({ value: ROYALTY_WEI });
    await contract.connect(student).release();
    await expect(contract.connect(student).release()).to.be.revertedWith(
      "InnovChain: already released"
    );
  });

  it("rejects funding twice", async function () {
    const { contract, company } = await deploy();
    await contract.connect(company).fund({ value: ROYALTY_WEI });
    await expect(contract.connect(company).fund({ value: ROYALTY_WEI })).to.be.revertedWith(
      "InnovChain: already funded"
    );
  });
});
