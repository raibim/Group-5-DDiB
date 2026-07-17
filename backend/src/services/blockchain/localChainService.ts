import { ethers, Contract, JsonRpcProvider, Wallet, ContractFactory, Log } from 'ethers';
import fs from 'fs';
import path from 'path';
import { env } from '../../config/env';
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

/**
 * PoC simplification (documented per project spec): the backend does not custody private
 * keys for individual students/companies - users only ever supply a public wallet address
 * at registration. All on-chain writes are therefore sent by a single "operator" wallet
 * (Hardhat dev account #0 in local mode) which acts on behalf of whichever user initiated
 * the API call. In production, each user would sign transactions client-side with their own
 * wallet (e.g. via MetaMask) and the backend would only ever relay/observe transactions.
 *
 * LicensingRoyalty.fund() and .release() both enforce `msg.sender` on-chain (only the
 * licensee company may fund; only the student or company may release). Simply sending those
 * transactions from the operator wallet would revert, since the operator is neither party.
 * Because CHAIN_MODE=local runs against a Hardhat node, we use Hardhat's
 * `hardhat_impersonateAccount` JSON-RPC method to sign as the actual student/company address
 * for that one call (a feature only available on Hardhat/Anvil dev networks - it lets any
 * unlocked account send a transaction without knowing its private key). The operator wallet
 * tops up that address with a small amount of ETH first if it doesn't have enough to cover
 * gas (+ value, for funding), since demo wallet addresses registered by users are not
 * necessarily pre-funded Hardhat accounts. None of this is available/safe on a real network,
 * which is why CHAIN_MODE=testnet falls back to sending directly from the operator wallet -
 * see the class-level comment on TestnetChainService below for that mode's limitation.
 */

function toBytes32Hash(fileHash: string): string {
  const hex = fileHash.startsWith('0x') ? fileHash.slice(2) : fileHash;
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(`fileHash must be a 32-byte hex string, got: ${fileHash}`);
  }
  return `0x${hex}`;
}

function resolveRegistryAddress(): string {
  if (env.OWNERSHIP_REGISTRY_ADDRESS) return env.OWNERSHIP_REGISTRY_ADDRESS;

  const network = env.CHAIN_MODE === 'local' ? 'localhost' : env.CHAIN_MODE;
  const deploymentPath = path.join(env.REPO_ROOT, 'contracts', 'deployments', `${network}.json`);
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(
      `OWNERSHIP_REGISTRY_ADDRESS is not set and no deployment file found at ${deploymentPath}. ` +
        'Deploy the contracts first (see contracts/README) or set the env var explicitly.',
    );
  }
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  const address = deployment.ownershipRegistry;
  if (!address) {
    throw new Error(`Deployment file ${deploymentPath} has no "ownershipRegistry" field.`);
  }
  return address;
}

const MIN_ACTOR_BALANCE = ethers.parseEther('1');
const TOP_UP_AMOUNT = ethers.parseEther('2');

export class LocalChainService implements BlockchainService {
  private provider: JsonRpcProvider;
  private operator: Wallet;
  private registryAddress: string;

  constructor() {
    this.provider = new JsonRpcProvider(env.RPC_URL);
    this.operator = new Wallet(env.OPERATOR_PRIVATE_KEY, this.provider);
    this.registryAddress = resolveRegistryAddress();
  }

  /** Ensures `address` can pay gas (and optionally `value`) by topping it up from the
   * operator wallet. Only meaningful on a local dev chain where the operator has
   * effectively unlimited test ETH. */
  private async ensureFunded(address: string, extraValue: bigint = 0n): Promise<void> {
    const balance = await this.provider.getBalance(address);
    const needed = MIN_ACTOR_BALANCE + extraValue;
    if (balance >= needed) return;
    const tx = await this.operator.sendTransaction({
      to: address,
      value: TOP_UP_AMOUNT + extraValue,
    });
    await tx.wait();
  }

  /** Impersonates `address` (Hardhat-only JSON-RPC method) and returns a signer for it. */
  private async impersonate(address: string) {
    await this.provider.send('hardhat_impersonateAccount', [address]);
    return this.provider.getSigner(address);
  }

  private async stopImpersonating(address: string): Promise<void> {
    await this.provider.send('hardhat_stopImpersonatingAccount', [address]);
  }

  async registerOwnership(input: RegisterOwnershipInput): Promise<RegisterOwnershipResult> {
    const fileHashBytes32 = toBytes32Hash(input.fileHash);

    await this.ensureFunded(input.ownerAddress);
    const ownerSigner = await this.impersonate(input.ownerAddress);
    try {
      const registry = new Contract(
        this.registryAddress,
        ownershipRegistryArtifact.abi,
        ownerSigner,
      );
      const tx = await registry.registerProject(fileHashBytes32);
      const receipt = await tx.wait();

      const registryInterface = registry.interface;
      let onChainId: number | undefined;
      for (const log of receipt.logs as Log[]) {
        if (log.address.toLowerCase() !== this.registryAddress.toLowerCase()) continue;
        try {
          const parsed = registryInterface.parseLog(log);
          if (parsed && parsed.name === 'ProjectRegistered') {
            onChainId = Number(parsed.args.projectId);
            break;
          }
        } catch {
          // not a ProjectRegistered log, ignore
        }
      }
      if (onChainId === undefined) {
        throw new Error('ProjectRegistered event not found in transaction receipt');
      }

      return {
        onChainId,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      };
    } finally {
      await this.stopImpersonating(input.ownerAddress);
    }
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
      BigInt(input.royaltyWei),
    );
    const receipt = await contract.deploymentTransaction()?.wait();
    if (!receipt) {
      throw new Error('LicensingRoyalty deployment did not produce a receipt');
    }
    return {
      address: await contract.getAddress(),
      deployTxHash: receipt.hash,
    };
  }

  async fundContract(input: FundContractInput): Promise<FundContractResult> {
    const value = BigInt(input.amountWei);
    await this.ensureFunded(input.fromAddress, value);
    const companySigner = await this.impersonate(input.fromAddress);
    try {
      const contract = new Contract(
        input.contractAddress,
        licensingRoyaltyArtifact.abi,
        companySigner,
      );
      const tx = await contract.fund({ value });
      const receipt = await tx.wait();
      return { txHash: receipt.hash };
    } finally {
      await this.stopImpersonating(input.fromAddress);
    }
  }

  async releaseContract(input: ReleaseContractInput): Promise<ReleaseContractResult> {
    await this.ensureFunded(input.fromAddress);
    const releaserSigner = await this.impersonate(input.fromAddress);
    try {
      const contract = new Contract(
        input.contractAddress,
        licensingRoyaltyArtifact.abi,
        releaserSigner,
      );
      const tx = await contract.release();
      const receipt = await tx.wait();

      let studentAmountWei = '0';
      let universityAmountWei = '0';
      for (const log of receipt.logs as Log[]) {
        if (log.address.toLowerCase() !== input.contractAddress.toLowerCase()) continue;
        try {
          const parsed = contract.interface.parseLog(log);
          if (parsed && parsed.name === 'Released') {
            studentAmountWei = parsed.args.studentAmount.toString();
            universityAmountWei = parsed.args.universityAmount.toString();
            break;
          }
        } catch {
          // ignore non-matching logs
        }
      }

      return {
        txHash: receipt.hash,
        studentAmountWei,
        universityAmountWei,
      };
    } finally {
      await this.stopImpersonating(input.fromAddress);
    }
  }
}
