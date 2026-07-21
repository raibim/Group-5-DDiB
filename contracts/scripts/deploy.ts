import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying OwnershipRegistry to '${network.name}' with account ${deployer.address}`);

  const Registry = await ethers.getContractFactory("OwnershipRegistry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log(`OwnershipRegistry deployed at ${registryAddress}`);

  // Owned by the deployer (the backend's operator wallet in local/testnet mode), which is
  // what lets the backend call the owner-only mint() after a sale releases.
  const LicenseNft = await ethers.getContractFactory("LicenseNFT");
  const licenseNft = await LicenseNft.deploy(deployer.address);
  await licenseNft.waitForDeployment();
  const licenseNftAddress = await licenseNft.getAddress();
  console.log(`LicenseNFT deployed at ${licenseNftAddress}`);

  const outDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${network.name}.json`);
  fs.writeFileSync(
    outFile,
    JSON.stringify(
      {
        network: network.name,
        ownershipRegistry: registryAddress,
        licenseNft: licenseNftAddress,
        deployer: deployer.address,
        deployedAt: new Date().toISOString(),
      },
      null,
      2
    )
  );
  console.log(`Wrote deployment info to ${outFile}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
