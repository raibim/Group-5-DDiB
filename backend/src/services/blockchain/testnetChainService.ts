import { Contract, JsonRpcProvider, Wallet, ContractFactory, Log } from 'ethers';
import { env } from '../../config/env';
import fs from 'fs';
import path from 'path';
import ownershipRegistryArtifact from './artifacts/OwnershipRegistry.json';
import licensingRoyaltyArtifact from './artifacts/LicensingRoyalty.json';
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

  constructor() {
    this.provider = new JsonRpcProvider(env.RPC_URL);
    this.operator = new Wallet(env.OPERATOR_PRIVATE_KEY, this.provider);
    this.registryAddress = resolveRegistryAddress();
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
      input.studentBps,
      input.universityBps,
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
    let companyAmountWei = '0';
    for (const log of receipt.logs as Log[]) {
      if (log.address.toLowerCase() !== input.contractAddress.toLowerCase()) continue;
      try {
        const parsed = contract.interface.parseLog(log);
        if (parsed && parsed.name === 'Released') {
          studentAmountWei = parsed.args.studentAmount.toString();
          universityAmountWei = parsed.args.universityAmount.toString();
          companyAmountWei = parsed.args.companyAmount.toString();
          break;
        }
      } catch {
        // ignore
      }
    }
    return { txHash: receipt.hash, studentAmountWei, universityAmountWei, companyAmountWei };
  }
}
