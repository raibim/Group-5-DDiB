import { expect } from "chai";
import { ethers } from "hardhat";

describe("LicensingRoyalty", function () {
  const STUDENT_BPS = 8500; // 85% of the full sale price
  const UNIVERSITY_BPS = 500; // 5%
  const PLATFORM_BPS = 1000; // 10%
  // The company funds the FULL agreed sale price - nothing is held back.
  const PRICE_WEI = ethers.parseEther("1");

  async function deploy() {
    const [, student, university, company, platform, stranger] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("LicensingRoyalty");
    const contract = await Factory.deploy(
      student.address,
      university.address,
      company.address,
      platform.address,
      STUDENT_BPS,
      UNIVERSITY_BPS,
      PLATFORM_BPS,
      PRICE_WEI
    );
    await contract.waitForDeployment();
    return { contract, student, university, company, platform, stranger };
  }

  it("stores the bps split and full price", async function () {
    const { contract } = await deploy();
    expect(await contract.studentBps()).to.equal(STUDENT_BPS);
    expect(await contract.universityBps()).to.equal(UNIVERSITY_BPS);
    expect(await contract.platformBps()).to.equal(PLATFORM_BPS);
    expect(await contract.priceWei()).to.equal(PRICE_WEI);
  });

  it("rejects deployment when bps don't sum to exactly 100%", async function () {
    const [, student, university, company, platform] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("LicensingRoyalty");
    await expect(
      Factory.deploy(
        student.address,
        university.address,
        company.address,
        platform.address,
        8500,
        500,
        900, // sums to 9900, not 10000
        PRICE_WEI
      )
    ).to.be.revertedWith("InnovChain: bps must sum to 100%");
  });

  it("rejects a zero platform address", async function () {
    const [, student, university, company] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("LicensingRoyalty");
    await expect(
      Factory.deploy(
        student.address,
        university.address,
        company.address,
        ethers.ZeroAddress,
        STUDENT_BPS,
        UNIVERSITY_BPS,
        PLATFORM_BPS,
        PRICE_WEI
      )
    ).to.be.revertedWith("InnovChain: zero address");
  });

  it("only allows the company to fund, with the exact full sale price", async function () {
    const { contract, company, stranger } = await deploy();

    await expect(contract.connect(stranger).fund({ value: PRICE_WEI })).to.be.revertedWith(
      "InnovChain: only licensee company may fund"
    );
    await expect(
      contract.connect(company).fund({ value: ethers.parseEther("0.5") })
    ).to.be.revertedWith("InnovChain: incorrect amount");

    await expect(contract.connect(company).fund({ value: PRICE_WEI }))
      .to.emit(contract, "Funded")
      .withArgs(company.address, PRICE_WEI);

    expect(await contract.funded()).to.equal(true);
  });

  it("blocks release before funding", async function () {
    const { contract, student } = await deploy();
    await expect(contract.connect(student).release()).to.be.revertedWith(
      "InnovChain: not funded"
    );
  });

  it("splits the full escrowed price 85:5:10 between student, university, and platform", async function () {
    const { contract, student, university, company, platform } = await deploy();
    await contract.connect(company).fund({ value: PRICE_WEI });

    const before = {
      student: await ethers.provider.getBalance(student.address),
      university: await ethers.provider.getBalance(university.address),
      platform: await ethers.provider.getBalance(platform.address),
      company: await ethers.provider.getBalance(company.address),
    };

    const tx = await contract.connect(student).release();
    const receipt = await tx.wait();
    const gasCost = receipt!.gasUsed * receipt!.gasPrice;

    const expectedStudent = (PRICE_WEI * BigInt(STUDENT_BPS)) / 10000n;
    const expectedUniversity = (PRICE_WEI * BigInt(UNIVERSITY_BPS)) / 10000n;
    const expectedPlatform = PRICE_WEI - expectedStudent - expectedUniversity;

    const after = {
      student: await ethers.provider.getBalance(student.address),
      university: await ethers.provider.getBalance(university.address),
      platform: await ethers.provider.getBalance(platform.address),
      company: await ethers.provider.getBalance(company.address),
    };

    // student paid gas for this tx since they called release(), so net change is the
    // payout minus gas spent
    expect(after.student - before.student + gasCost).to.equal(expectedStudent);
    expect(after.university - before.university).to.equal(expectedUniversity);
    expect(after.platform - before.platform).to.equal(expectedPlatform);
    // the company never receives anything back from this contract - it was purely the payer
    expect(after.company - before.company).to.equal(0n);

    expect(await ethers.provider.getBalance(await contract.getAddress())).to.equal(0);
    expect(await contract.released()).to.equal(true);
  });

  it("cannot be released twice", async function () {
    const { contract, student, company } = await deploy();
    await contract.connect(company).fund({ value: PRICE_WEI });
    await contract.connect(student).release();
    await expect(contract.connect(student).release()).to.be.revertedWith(
      "InnovChain: already released"
    );
  });

  it("rejects funding twice", async function () {
    const { contract, company } = await deploy();
    await contract.connect(company).fund({ value: PRICE_WEI });
    await expect(contract.connect(company).fund({ value: PRICE_WEI })).to.be.revertedWith(
      "InnovChain: already funded"
    );
  });
});
