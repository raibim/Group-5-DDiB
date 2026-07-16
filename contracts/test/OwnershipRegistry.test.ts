import { expect } from "chai";
import { ethers } from "hardhat";
import { keccak256, toUtf8Bytes } from "ethers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";

describe("OwnershipRegistry", function () {
  async function deploy() {
    const [owner, other] = await ethers.getSigners();
    const Registry = await ethers.getContractFactory("OwnershipRegistry");
    const registry = await Registry.deploy();
    await registry.waitForDeployment();
    return { registry, owner, other };
  }

  it("registers a project and emits ProjectRegistered", async function () {
    const { registry, owner } = await deploy();
    const fileHash = keccak256(toUtf8Bytes("innovchain-project-1"));

    await expect(registry.registerProject(fileHash))
      .to.emit(registry, "ProjectRegistered")
      .withArgs(1n, owner.address, fileHash, anyValue);

    const [projOwner, projHash] = await registry.getProject(1);
    expect(projOwner).to.equal(owner.address);
    expect(projHash).to.equal(fileHash);
  });

  it("rejects duplicate hashes", async function () {
    const { registry, other } = await deploy();
    const fileHash = keccak256(toUtf8Bytes("duplicate-project"));

    await registry.registerProject(fileHash);
    await expect(
      registry.connect(other).registerProject(fileHash)
    ).to.be.revertedWith("InnovChain: duplicate project hash");
  });

  it("rejects an empty hash", async function () {
    const { registry } = await deploy();
    await expect(
      registry.registerProject(ethers.ZeroHash)
    ).to.be.revertedWith("InnovChain: empty hash");
  });

  it("reports hash registration status", async function () {
    const { registry } = await deploy();
    const fileHash = keccak256(toUtf8Bytes("status-check"));
    expect(await registry.isHashRegistered(fileHash)).to.equal(false);
    await registry.registerProject(fileHash);
    expect(await registry.isHashRegistered(fileHash)).to.equal(true);
  });
});
