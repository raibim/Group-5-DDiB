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

export type ProjectCategory = 'final-year' | 'hackathon' | 'summer-school';

export const PROJECT_CATEGORIES: ProjectCategory[] = [
  'final-year',
  'hackathon',
  'summer-school',
];

export const PROJECT_CATEGORY_LABELS: Record<ProjectCategory, string> = {
  'final-year': 'Final Year Projects',
  hackathon: 'Hackathon',
  'summer-school': 'Summer School',
};

export interface Project {
  _id: string;
  owner: string | User;
  title: string;
  description: string;
  category: ProjectCategory;
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
  companyBps: number; // informational only; the company's share is never escrowed or paid out
  royaltyWei: string; // the actual amount escrowed and funded (student+university share only)
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
