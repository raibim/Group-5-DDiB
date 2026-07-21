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
  platformAddress: string;
  studentBps: number;
  universityBps: number;
  platformBps: number;
  // The FULL agreed sale price - the company funds this entire amount, which is then split
  // 85%/5%/10% (student/university/platform) on release. See LicensingRoyalty.sol.
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
  platformAmountWei: string;
}

export interface MintLicenseInput {
  toAddress: string; // the company that just completed the sale
  sourceLicenseRequestId: number; // a small integer id used only to tag the NFT; not the Mongo _id
  studentAddress: string;
  universityAddress: string;
  platformAddress: string;
  studentBps: number;
  universityBps: number;
  platformBps: number;
}

export interface MintLicenseResult {
  tokenId: number;
  mintTxHash: string;
}

export interface SublicenseInput {
  tokenId: number;
  fromAddress: string; // current holder (must match on-chain owner); msg.sender for the tx
  toAddress: string; // buyer
  priceWei: string;
}

export interface SublicenseResult {
  txHash: string;
  studentAmountWei: string;
  universityAmountWei: string;
  platformAmountWei: string;
  sellerAmountWei: string;
}

export interface BlockchainService {
  registerOwnership(input: RegisterOwnershipInput): Promise<RegisterOwnershipResult>;

  deployLicensingContract(
    input: DeployLicensingContractInput,
  ): Promise<DeployLicensingContractResult>;

  fundContract(input: FundContractInput): Promise<FundContractResult>;

  releaseContract(input: ReleaseContractInput): Promise<ReleaseContractResult>;

  mintLicense(input: MintLicenseInput): Promise<MintLicenseResult>;

  sublicense(input: SublicenseInput): Promise<SublicenseResult>;
}
