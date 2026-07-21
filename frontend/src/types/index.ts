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
  platformAddress: string;
  studentBps: number;
  universityBps: number;
  platformBps: number;
  priceWei: string; // the FULL sale price; escrowed and paid out in full on release
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
  platformAmountWei: string;
}

export interface LicenseNft {
  tokenId: number;
  mintTxHash: string;
  // The resale royalty split (deliberately smaller than the original sale's studentBps/
  // universityBps/platformBps on `contract`) - what actually applies on a sublicense.
  studentBps: number;
  universityBps: number;
  platformBps: number;
}

export interface Sublicense {
  toCompany: string | User;
  toAddress: string;
  priceWei: string;
  txHash: string;
  studentAmountWei: string;
  universityAmountWei: string;
  platformAmountWei: string;
  sellerAmountWei: string;
  createdAt: string;
}

export interface LicenseRequest {
  _id: string;
  project: string | Project;
  company: string | User; // the CURRENT holder - moves on each sublicense
  durationMonths: number;
  commercialUse: boolean;
  priceWei: string;
  status: LicenseRequestStatus;
  contract: LicenseContract | null;
  funding: LicenseFunding | null;
  release: LicenseRelease | null;
  licenseNft: LicenseNft | null;
  sublicenses: Sublicense[];
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}
