export type Role = 'student' | 'company' | 'university' | 'admin';

export interface User {
  _id: string;
  email: string;
  role: Role;
  name: string;
  walletAddress: string;
  createdAt: string;
}

export interface OwnershipProof {
  onChainId: number;
  txHash: string;
  blockNumber: number;
  registeredAt: string;
}

export type Visibility = 'public' | 'private';

export interface Project {
  _id: string;
  owner: string | User;
  title: string;
  description: string;
  fileName: string;
  fileHash: string;
  storagePath: string;
  tags: string[];
  visibility: Visibility;
  ownershipProof: OwnershipProof;
  createdAt: string;
}

export type LicenseRequestStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'funded'
  | 'released';

export interface LicenseContract {
  address: string;
  studentAddress: string;
  universityAddress: string;
  companyAddress: string;
  studentBps: number;
  universityBps: number;
  companyBps: number;
  deployTxHash: string;
}

export interface LicenseFunding {
  txHash: string;
  amountWei: string;
}

export interface LicenseRelease {
  txHash: string;
  studentAmountWei: string;
  universityAmountWei: string;
  companyAmountWei: string;
}

export interface LicenseRequest {
  _id: string;
  project: string | Project;
  company: string | User;
  durationMonths: number;
  commercialUse: boolean;
  priceWei: string;
  status: LicenseRequestStatus;
  contract: LicenseContract | null;
  funding: LicenseFunding | null;
  release: LicenseRelease | null;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}
