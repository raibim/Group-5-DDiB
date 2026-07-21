import { expect } from "chai";
import { ethers } from "hardhat";

describe("LicenseNFT", function () {
  const STUDENT_BPS = 8500;
  const UNIVERSITY_BPS = 500;
  const PLATFORM_BPS = 1000;
  const SOURCE_LICENSE_REQUEST_ID = 42;

  async function deploy() {
    const [owner, student, university, platform, company, buyer, stranger] =
      await ethers.getSigners();
    const Factory = await ethers.getContractFactory("LicenseNFT");
    const nft = await Factory.connect(owner).deploy(owner.address);
    await nft.waitForDeployment();
    return { nft, owner, student, university, platform, company, buyer, stranger };
  }

  async function mintOne(ctx: Awaited<ReturnType<typeof deploy>>) {
    const { nft, owner, student, university, platform, company } = ctx;
    const tx = await nft
      .connect(owner)
      .mint(
        company.address,
        SOURCE_LICENSE_REQUEST_ID,
        student.address,
        university.address,
        platform.address,
        STUDENT_BPS,
        UNIVERSITY_BPS,
        PLATFORM_BPS
      );
    const receipt = await tx.wait();
    return receipt;
  }

  it("mints to the company, only when called by the owner (operator wallet)", async function () {
    const ctx = await deploy();
    const { nft, company, stranger } = ctx;

    await expect(
      nft
        .connect(stranger)
        .mint(
          company.address,
          SOURCE_LICENSE_REQUEST_ID,
          stranger.address,
          stranger.address,
          stranger.address,
          STUDENT_BPS,
          UNIVERSITY_BPS,
          PLATFORM_BPS
        )
    ).to.be.revertedWithCustomError(nft, "OwnableUnauthorizedAccount");

    await mintOne(ctx);
    expect(await nft.ownerOf(1)).to.equal(company.address);
    expect(await nft.sourceLicenseRequestId(1)).to.equal(SOURCE_LICENSE_REQUEST_ID);
  });

  it("rejects a split summing over 100%", async function () {
    const { nft, owner, student, university, platform, company } = await deploy();
    await expect(
      nft
        .connect(owner)
        .mint(
          company.address,
          SOURCE_LICENSE_REQUEST_ID,
          student.address,
          university.address,
          platform.address,
          9000,
          500,
          1000
        )
    ).to.be.revertedWith("InnovChain: bps overflow");
  });

  it("exposes ERC-2981 royaltyInfo matching the combined split, with this contract as receiver", async function () {
    const ctx = await deploy();
    const { nft } = ctx;
    await mintOne(ctx);

    const [receiver, amount] = await nft.royaltyInfo(1, ethers.parseEther("1"));
    expect(receiver).to.equal(await nft.getAddress());
    // (8500 + 500 + 1000) / 10000 = 100% of the sale price in this default split
    expect(amount).to.equal(ethers.parseEther("1"));
  });

  it("only allows the current holder to sublicense", async function () {
    const ctx = await deploy();
    const { nft, stranger, buyer } = ctx;
    await mintOne(ctx);

    await expect(
      nft.connect(stranger).sublicense(1, buyer.address, { value: ethers.parseEther("1") })
    ).to.be.revertedWith("InnovChain: only current holder may sublicense");
  });

  it("rejects a zero-value sublicense", async function () {
    const ctx = await deploy();
    const { nft, company, buyer } = ctx;
    await mintOne(ctx);

    await expect(
      nft.connect(company).sublicense(1, buyer.address, { value: 0 })
    ).to.be.revertedWith("InnovChain: price must be > 0");
  });

  it("splits the sublicense price 85:5:10 to student/university/platform, forwards the rest to the seller, and transfers the token", async function () {
    const ctx = await deploy();
    const { nft, student, university, platform, company, buyer } = ctx;
    await mintOne(ctx);

    const price = ethers.parseEther("2");
    const before = {
      student: await ethers.provider.getBalance(student.address),
      university: await ethers.provider.getBalance(university.address),
      platform: await ethers.provider.getBalance(platform.address),
      company: await ethers.provider.getBalance(company.address),
    };

    const tx = await nft.connect(company).sublicense(1, buyer.address, { value: price });
    const receipt = await tx.wait();
    const gasCost = receipt!.gasUsed * receipt!.gasPrice;

    const expectedStudent = (price * BigInt(STUDENT_BPS)) / 10000n;
    const expectedUniversity = (price * BigInt(UNIVERSITY_BPS)) / 10000n;
    const expectedPlatform = (price * BigInt(PLATFORM_BPS)) / 10000n;
    const expectedSeller = price - expectedStudent - expectedUniversity - expectedPlatform;

    const after = {
      student: await ethers.provider.getBalance(student.address),
      university: await ethers.provider.getBalance(university.address),
      platform: await ethers.provider.getBalance(platform.address),
      company: await ethers.provider.getBalance(company.address),
    };

    expect(after.student - before.student).to.equal(expectedStudent);
    expect(after.university - before.university).to.equal(expectedUniversity);
    expect(after.platform - before.platform).to.equal(expectedPlatform);
    // company sent `price` as msg.value, paid gas, and received its seller share back
    expect(after.company - before.company).to.equal(expectedSeller - price - gasCost);
    expect(await nft.ownerOf(1)).to.equal(buyer.address);
  });

  it("keeps the royalty split attached to the token after a sublicense, for a further resale", async function () {
    const ctx = await deploy();
    const { nft, student, university, platform, company, buyer, stranger } = ctx;
    await mintOne(ctx);

    await nft.connect(company).sublicense(1, buyer.address, { value: ethers.parseEther("1") });

    const before = await ethers.provider.getBalance(student.address);
    await nft.connect(buyer).sublicense(1, stranger.address, { value: ethers.parseEther("1") });
    const after = await ethers.provider.getBalance(student.address);

    expect(after - before).to.equal((ethers.parseEther("1") * BigInt(STUDENT_BPS)) / 10000n);
    expect(await nft.ownerOf(1)).to.equal(stranger.address);
  });

  it("has no receive/fallback, so a bare ETH transfer to the contract reverts rather than getting stuck", async function () {
    const ctx = await deploy();
    const { nft, owner } = ctx;
    await expect(
      owner.sendTransaction({ to: await nft.getAddress(), value: ethers.parseEther("1") })
    ).to.be.reverted;
  });
});
