import { Contract, JsonRpcProvider, Wallet, ContractFactory, Log } from 'ethers';
import { env } from '../../config/env';
import fs from 'fs';
import path from 'path';
import ownershipRegistryArtifact from './artifacts/OwnershipRegistry.json';
import licensingRoyaltyArtifact from './artifacts/LicensingRoyalty.json';
import licenseNftArtifact from './artifacts/LicenseNFT.json';
import {
  BlockchainService,
  RegisterOwnershipInput,
  RegisterOwnershipResult,
  DeployLicensingContractInput,
  DeployLicensingContractResult,
  FundContractInput,
  FundContractResult,
  ReleaseContractInput,
  ReleaseContractResult,
  MintLicenseInput,
  MintLicenseResult,
  SublicenseInput,
  SublicenseResult,
} from './types';

function toBytes32Hash(fileHash: string): string {
  const hex = fileHash.startsWith('0x') ? fileHash.slice(2) : fileHash;
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(`fileHash must be a 32-byte hex string, got: ${fileHash}`);
  }
  return `0x${hex}`;
}

function resolveRegistryAddress(): string {
  if (env.OWNERSHIP_REGISTRY_ADDRESS) return env.OWNERSHIP_REGISTRY_ADDRESS;
  const deploymentPath = path.join(
    env.REPO_ROOT,
    'contracts',
    'deployments',
    `${env.CHAIN_MODE}.json`,
  );
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(
      `OWNERSHIP_REGISTRY_ADDRESS is not set and no deployment file found at ${deploymentPath}.`,
    );
  }
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  return deployment.ownershipRegistry;
}

function resolveLicenseNftAddress(): string {
  if (env.LICENSE_NFT_ADDRESS) return env.LICENSE_NFT_ADDRESS;
  const deploymentPath = path.join(
    env.REPO_ROOT,
    'contracts',
    'deployments',
    `${env.CHAIN_MODE}.json`,
  );
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(
      `LICENSE_NFT_ADDRESS is not set and no deployment file found at ${deploymentPath}.`,
    );
  }
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  return deployment.licenseNft;
}

/**
 * CHAIN_MODE=testnet points at a real public network (e.g. Sepolia) via RPC_URL. There is
 * no equivalent of Hardhat's `hardhat_impersonateAccount` on a real chain, so this service
 * cannot sign as an arbitrary student/company address the way LocalChainService does.
 *
 * PoC limitation (out of scope to fully solve for this course project, documented per
 * docs/API.md's "Out of scope" list): every write is sent directly from the operator
 * wallet. registerOwnership will therefore record the *operator* as on-chain owner rather
 * than the student's own address, and fundContract/releaseContract will revert unless the
 * registered student/company walletAddress happens to equal the operator's address. A real
 * deployment would instead have the frontend collect a client-side signature (e.g. via
 * MetaMask) for these calls and never route them through a server-held key at all.
 */
export class TestnetChainService implements BlockchainService {
  private provider: JsonRpcProvider;
  private operator: Wallet;
  private registryAddress: string;
  private licenseNftAddress: string;

  constructor() {
    this.provider = new JsonRpcProvider(env.RPC_URL);
    this.operator = new Wallet(env.OPERATOR_PRIVATE_KEY, this.provider);
    this.registryAddress = resolveRegistryAddress();
    this.licenseNftAddress = resolveLicenseNftAddress();
  }

  async registerOwnership(input: RegisterOwnershipInput): Promise<RegisterOwnershipResult> {
    const fileHashBytes32 = toBytes32Hash(input.fileHash);
    const registry = new Contract(this.registryAddress, ownershipRegistryArtifact.abi, this.operator);
    const tx = await registry.registerProject(fileHashBytes32);
    const receipt = await tx.wait();

    let onChainId: number | undefined;
    for (const log of receipt.logs as Log[]) {
      if (log.address.toLowerCase() !== this.registryAddress.toLowerCase()) continue;
      try {
        const parsed = registry.interface.parseLog(log);
        if (parsed && parsed.name === 'ProjectRegistered') {
          onChainId = Number(parsed.args.projectId);
          break;
        }
      } catch {
        // ignore
      }
    }
    if (onChainId === undefined) {
      throw new Error('ProjectRegistered event not found in transaction receipt');
    }
    return { onChainId, txHash: receipt.hash, blockNumber: receipt.blockNumber };
  }

  async deployLicensingContract(
    input: DeployLicensingContractInput,
  ): Promise<DeployLicensingContractResult> {
    const factory = new ContractFactory(
      licensingRoyaltyArtifact.abi,
      licensingRoyaltyArtifact.bytecode,
      this.operator,
    );
    const contract = await factory.deploy(
      input.studentAddress,
      input.universityAddress,
      input.companyAddress,
      input.platformAddress,
      input.studentBps,
      input.universityBps,
      input.platformBps,
      BigInt(input.priceWei),
    );
    const receipt = await contract.deploymentTransaction()?.wait();
    if (!receipt) throw new Error('LicensingRoyalty deployment did not produce a receipt');
    return { address: await contract.getAddress(), deployTxHash: receipt.hash };
  }

  async fundContract(input: FundContractInput): Promise<FundContractResult> {
    const contract = new Contract(input.contractAddress, licensingRoyaltyArtifact.abi, this.operator);
    const tx = await contract.fund({ value: BigInt(input.amountWei) });
    const receipt = await tx.wait();
    return { txHash: receipt.hash };
  }

  async releaseContract(input: ReleaseContractInput): Promise<ReleaseContractResult> {
    const contract = new Contract(input.contractAddress, licensingRoyaltyArtifact.abi, this.operator);
    const tx = await contract.release();
    const receipt = await tx.wait();

    let studentAmountWei = '0';
    let universityAmountWei = '0';
    let platformAmountWei = '0';
    for (const log of receipt.logs as Log[]) {
      if (log.address.toLowerCase() !== input.contractAddress.toLowerCase()) continue;
      try {
        const parsed = contract.interface.parseLog(log);
        if (parsed && parsed.name === 'Released') {
          studentAmountWei = parsed.args.studentAmount.toString();
          universityAmountWei = parsed.args.universityAmount.toString();
          platformAmountWei = parsed.args.platformAmount.toString();
          break;
        }
      } catch {
        // ignore
      }
    }
    return { txHash: receipt.hash, studentAmountWei, universityAmountWei, platformAmountWei };
  }

  /** Owner-only, same as local mode - the operator wallet deployed (and owns) LicenseNFT. */
  async mintLicense(input: MintLicenseInput): Promise<MintLicenseResult> {
    const contract = new Contract(this.licenseNftAddress, licenseNftArtifact.abi, this.operator);
    const tx = await contract.mint(
      input.toAddress,
      input.sourceLicenseRequestId,
      input.studentAddress,
      input.universityAddress,
      input.platformAddress,
      input.studentBps,
      input.universityBps,
      input.platformBps,
    );
    const receipt = await tx.wait();

    let tokenId: number | undefined;
    for (const log of receipt.logs as Log[]) {
      if (log.address.toLowerCase() !== this.licenseNftAddress.toLowerCase()) continue;
      try {
        const parsed = contract.interface.parseLog(log);
        if (parsed && parsed.name === 'LicenseMinted') {
          tokenId = Number(parsed.args.tokenId);
          break;
        }
      } catch {
        // ignore
      }
    }
    if (tokenId === undefined) {
      throw new Error('LicenseMinted event not found in transaction receipt');
    }
    return { tokenId, mintTxHash: receipt.hash };
  }

  /** Same PoC limitation as fundContract/releaseContract above: sent directly from the
   * operator wallet, since there is no impersonation on a real network. Will revert unless
   * the current NFT holder's wallet happens to equal the operator's address. */
  async sublicense(input: SublicenseInput): Promise<SublicenseResult> {
    const value = BigInt(input.priceWei);
    const contract = new Contract(this.licenseNftAddress, licenseNftArtifact.abi, this.operator);
    const tx = await contract.sublicense(input.tokenId, input.toAddress, { value });
    const receipt = await tx.wait();

    const split = await contract.royaltySplits(input.tokenId);
    const studentAmountWei = ((value * BigInt(split.studentBps)) / 10000n).toString();
    const universityAmountWei = ((value * BigInt(split.universityBps)) / 10000n).toString();
    const platformAmountWei = ((value * BigInt(split.platformBps)) / 10000n).toString();
    const sellerAmountWei = (
      value -
      BigInt(studentAmountWei) -
      BigInt(universityAmountWei) -
      BigInt(platformAmountWei)
    ).toString();

    return {
      txHash: receipt.hash,
      studentAmountWei,
      universityAmountWei,
      platformAmountWei,
      sellerAmountWei,
    };
  }
}
