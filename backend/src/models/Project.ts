import { Schema, model, Document, Types } from 'mongoose';

export interface IOwnershipProof {
  onChainId: number;
  txHash: string;
  blockNumber: number;
  registeredAt: Date;
}

export interface IProject extends Document {
  _id: Types.ObjectId;
  owner: Types.ObjectId;
  title: string;
  description: string;
  fileName: string;
  fileHash: string;
  storagePath: string;
  tags: string[];
  visibility: 'public' | 'private';
  ownershipProof: IOwnershipProof;
  createdAt: Date;
}

const ownershipProofSchema = new Schema<IOwnershipProof>(
  {
    onChainId: { type: Number, required: true },
    txHash: { type: String, required: true },
    blockNumber: { type: Number, required: true },
    registeredAt: { type: Date, required: true },
  },
  { _id: false },
);

const projectSchema = new Schema<IProject>({
  owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  fileName: { type: String, required: true },
  fileHash: { type: String, required: true },
  storagePath: { type: String, required: true },
  tags: { type: [String], default: [] },
  visibility: { type: String, enum: ['public', 'private'], default: 'public' },
  ownershipProof: { type: ownershipProofSchema, required: true },
  createdAt: { type: Date, default: () => new Date() },
});

export const Project = model<IProject>('Project', projectSchema);
