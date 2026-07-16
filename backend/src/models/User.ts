import { Schema, model, Document, Types } from 'mongoose';

export type UserRole = 'student' | 'company' | 'university' | 'admin';

export interface IUser extends Document {
  _id: Types.ObjectId;
  email: string;
  passwordHash: string;
  role: UserRole;
  name: string;
  walletAddress: string;
  createdAt: Date;
}

const userSchema = new Schema<IUser>({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: {
    type: String,
    enum: ['student', 'company', 'university', 'admin'],
    required: true,
  },
  name: { type: String, required: true, trim: true },
  walletAddress: { type: String, required: true },
  createdAt: { type: Date, default: () => new Date() },
});

export const User = model<IUser>('User', userSchema);

/** Shape returned to clients - never leak passwordHash. */
export function toPublicUser(user: IUser) {
  return {
    id: user._id.toString(),
    email: user.email,
    role: user.role,
    name: user.name,
    walletAddress: user.walletAddress,
    createdAt: user.createdAt,
  };
}
