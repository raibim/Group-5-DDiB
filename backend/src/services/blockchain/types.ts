export interface RegisterOwnershipInput {
  projectId: string;
  fileHash: string; // sha256 hex (no 0x prefix) or already 0x-prefixed bytes32
  ownerAddress: string;
}

export interface RegisterOwnershipResult {
  onChainId: number;
  txHash: string;
  blockNumber: number;
}

export interface DeployLicensingContractInput {
  studentAddress: string;
  universityAddress: string;
  companyAddress: string;
  studentBps: number;
  universityBps: number;
  priceWei: string;
}

export interface DeployLicensingContractResult {
  address: string;
  deployTxHash: string;
}

export interface FundContractInput {
  contractAddress: string;
  amountWei: string;
  fromRole: 'company';
  // Address that must appear as msg.sender on-chain (the company's wallet). Required so the
  // service can satisfy LicensingRoyalty's `msg.sender == companyAddress` check - see the
  // PoC-simplification comment in localChainService.ts.
  fromAddress: string;
}

export interface FundContractResult {
  txHash: string;
}

export interface ReleaseContractInput {
  contractAddress: string;
  // Address that triggers release on-chain (student or company wallet); must satisfy
  // LicensingRoyalty's `msg.sender == studentAddress || msg.sender == companyAddress`.
  fromAddress: string;
}

export interface ReleaseContractResult {
  txHash: string;
  studentAmountWei: string;
  universityAmountWei: string;
  companyAmountWei: string;
}

export interface BlockchainService {
  registerOwnership(input: RegisterOwnershipInput): Promise<RegisterOwnershipResult>;

  deployLicensingContract(
    input: DeployLicensingContractInput,
  ): Promise<DeployLicensingContractResult>;

  fundContract(input: FundContractInput): Promise<FundContractResult>;

  releaseContract(input: ReleaseContractInput): Promise<ReleaseContractResult>;
}
