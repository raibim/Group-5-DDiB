import { Schema, model, Document, Types } from 'mongoose';

export type LicenseRequestStatus = 'pending' | 'accepted' | 'rejected' | 'funded' | 'released';

export interface ILicenseContract {
  address: string;
  studentAddress: string;
  universityAddress: string;
  companyAddress: string;
  studentBps: number;
  universityBps: number;
  companyBps: number; // informational only; the company's share is never escrowed or paid out
  royaltyWei: string; // the actual amount escrowed and funded: priceWei * (studentBps+universityBps)/10000
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
}

export interface ILicenseRequest extends Document {
  _id: Types.ObjectId;
  project: Types.ObjectId;
  company: Types.ObjectId;
  durationMonths: number;
  commercialUse: boolean;
  priceWei: string;
  status: LicenseRequestStatus;
  contract: ILicenseContract | null;
  funding: IFunding | null;
  release: IRelease | null;
  createdAt: Date;
}

const contractSchema = new Schema<ILicenseContract>(
  {
    address: { type: String, required: true },
    studentAddress: { type: String, required: true },
    universityAddress: { type: String, required: true },
    companyAddress: { type: String, required: true },
    studentBps: { type: Number, required: true },
    universityBps: { type: Number, required: true },
    companyBps: { type: Number, required: true },
    royaltyWei: { type: String, required: true },
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
  createdAt: { type: Date, default: () => new Date() },
});

export const LicenseRequest = model<ILicenseRequest>('LicenseRequest', licenseRequestSchema);
