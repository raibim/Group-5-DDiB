import { z } from 'zod';
import { PROJECT_CATEGORIES } from '../models/Project';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'password must be at least 8 characters'),
  role: z.enum(['student', 'company', 'university', 'admin']),
  name: z.string().min(1),
  walletAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'walletAddress must be a valid EVM address'),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/** multipart form fields for POST /projects arrive as strings; tags[] may be a single
 * string or an array of strings depending on how the client encodes the form. */
export const createProjectSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.enum(PROJECT_CATEGORIES),
  tags: z
    .union([z.array(z.string()), z.string()])
    .optional()
    .transform((v) => {
      if (v === undefined) return [] as string[];
      if (Array.isArray(v)) return v;
      // allow comma-separated string as a convenience for plain HTML forms
      return v
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
    }),
  visibility: z.enum(['public', 'private']).optional().default('public'),
});

export const createLicenseRequestSchema = z.object({
  durationMonths: z.coerce.number().int().positive(),
  commercialUse: z.coerce.boolean(),
  priceEth: z.coerce.number().positive(),
});
