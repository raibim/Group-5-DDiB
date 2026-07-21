import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { User, toPublicUser } from '../models/User';
import { signToken, requireAuth, requireRole } from '../middleware/auth';
import { registerSchema, loginSchema } from '../validation/schemas';
import { asyncHandler } from '../utils/asyncHandler';
import { HttpError } from '../middleware/errorHandler';

const router = Router();

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const body = registerSchema.parse(req.body);

    const existing = await User.findOne({ email: body.email.toLowerCase() });
    if (existing) {
      throw new HttpError(409, 'Email already registered');
    }

    const passwordHash = await bcrypt.hash(body.password, 10);
    const user = await User.create({
      email: body.email.toLowerCase(),
      passwordHash,
      role: body.role,
      name: body.name,
      walletAddress: body.walletAddress,
    });

    const token = signToken(user);
    res.status(201).json({ token, user: toPublicUser(user) });
  }),
);

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body);

    const user = await User.findOne({ email: body.email.toLowerCase() });
    if (!user) {
      throw new HttpError(401, 'Invalid email or password');
    }
    const valid = await bcrypt.compare(body.password, user.passwordHash);
    if (!valid) {
      throw new HttpError(401, 'Invalid email or password');
    }

    const token = signToken(user);
    res.json({ token, user: toPublicUser(user) });
  }),
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: toPublicUser(req.user!) });
  }),
);

// GET /auth/companies - other registered companies, for the sublicense "transfer to" picker.
router.get(
  '/companies',
  requireAuth,
  requireRole('company'),
  asyncHandler(async (req, res) => {
    const companies = await User.find({ role: 'company', _id: { $ne: req.user!._id } });
    res.json({ companies: companies.map(toPublicUser) });
  }),
);

export default router;
