import { Schema, model, Document, Types } from 'mongoose';

export type LicenseRequestStatus = 'pending' | 'accepted' | 'rejected' | 'funded' | 'released';

export interface ILicenseContract {
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

export interface IFunding {
  txHash: string;
  amountWei: string;
}

export interface IRelease {
  txHash: string;
  studentAmountWei: string;
  universityAmountWei: string;
  platformAmountWei: string;
}

// Minted to `company`'s wallet once release() succeeds - holding the token IS holding the
// license. studentBps/universityBps/platformBps here are the RESALE royalty split (see
// RESALE_ROYALTY_BPS in licenseRequests.ts) - deliberately smaller than and independent of
// `contract`'s 85/5/10 sale split, so a reselling company keeps most of any resale price.
export interface ILicenseNft {
  tokenId: number;
  mintTxHash: string;
  studentBps: number;
  universityBps: number;
  platformBps: number;
}

// One entry per sublicense() call - `company` above always reflects the CURRENT holder, and
// this array is the audit trail of how it got there.
export interface ISublicense {
  toCompany: Types.ObjectId;
  toAddress: string;
  priceWei: string;
  txHash: string;
  studentAmountWei: string;
  universityAmountWei: string;
  platformAmountWei: string;
  sellerAmountWei: string;
  createdAt: Date;
}

export interface ILicenseRequest extends Document {
  _id: Types.ObjectId;
  project: Types.ObjectId;
  company: Types.ObjectId; // the CURRENT license holder - moves on each sublicense
  durationMonths: number;
  commercialUse: boolean;
  priceWei: string;
  status: LicenseRequestStatus;
  contract: ILicenseContract | null;
  funding: IFunding | null;
  release: IRelease | null;
  licenseNft: ILicenseNft | null;
  sublicenses: ISublicense[];
  createdAt: Date;
}

const contractSchema = new Schema<ILicenseContract>(
  {
    address: { type: String, required: true },
    studentAddress: { type: String, required: true },
    universityAddress: { type: String, required: true },
    companyAddress: { type: String, required: true },
    platformAddress: { type: String, required: true },
    studentBps: { type: Number, required: true },
    universityBps: { type: Number, required: true },
    platformBps: { type: Number, required: true },
    priceWei: { type: String, required: true },
    deployTxHash: { type: String, required: true },
  },
  { _id: false },
);

const fundingSchema = new Schema<IFunding>(
  {
    txHash: { type: String, required: true },
    amountWei: { type: String, required: true },
  },
  { _id: false },
);

const releaseSchema = new Schema<IRelease>(
  {
    txHash: { type: String, required: true },
    studentAmountWei: { type: String, required: true },
    universityAmountWei: { type: String, required: true },
    platformAmountWei: { type: String, required: true },
  },
  { _id: false },
);

const licenseNftSchema = new Schema<ILicenseNft>(
  {
    tokenId: { type: Number, required: true },
    mintTxHash: { type: String, required: true },
    studentBps: { type: Number, required: true },
    universityBps: { type: Number, required: true },
    platformBps: { type: Number, required: true },
  },
  { _id: false },
);

const sublicenseSchema = new Schema<ISublicense>(
  {
    toCompany: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    toAddress: { type: String, required: true },
    priceWei: { type: String, required: true },
    txHash: { type: String, required: true },
    studentAmountWei: { type: String, required: true },
    universityAmountWei: { type: String, required: true },
    platformAmountWei: { type: String, required: true },
    sellerAmountWei: { type: String, required: true },
    createdAt: { type: Date, default: () => new Date() },
  },
  { _id: false },
);

const licenseRequestSchema = new Schema<ILicenseRequest>({
  project: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
  company: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  durationMonths: { type: Number, required: true },
  commercialUse: { type: Boolean, required: true },
  priceWei: { type: String, required: true },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'funded', 'released'],
    default: 'pending',
  },
  contract: { type: contractSchema, default: null },
  funding: { type: fundingSchema, default: null },
  release: { type: releaseSchema, default: null },
  licenseNft: { type: licenseNftSchema, default: null },
  sublicenses: { type: [sublicenseSchema], default: [] },
  createdAt: { type: Date, default: () => new Date() },
});

export const LicenseRequest = model<ILicenseRequest>('LicenseRequest', licenseRequestSchema);
