import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying OwnershipRegistry to '${network.name}' with account ${deployer.address}`);

  const Registry = await ethers.getContractFactory("OwnershipRegistry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();

  const address = await registry.getAddress();
  console.log(`OwnershipRegistry deployed at ${address}`);

  const outDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${network.name}.json`);
  fs.writeFileSync(
    outFile,
    JSON.stringify(
      {
        network: network.name,
        ownershipRegistry: address,
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
