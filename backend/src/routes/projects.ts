import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { Project } from '../models/Project';
import { requireAuth, requireRole, optionalAuth } from '../middleware/auth';
import { createProjectSchema } from '../validation/schemas';
import { asyncHandler } from '../utils/asyncHandler';
import { HttpError } from '../middleware/errorHandler';
import { sha256Hex } from '../utils/hash';
import { getBlockchainService } from '../services/blockchain';
import { env } from '../config/env';

const router = Router();

fs.mkdirSync(env.UPLOAD_DIR, { recursive: true });
const upload = multer({ storage: multer.memoryStorage() });

router.post(
  '/',
  requireAuth,
  requireRole('student'),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new HttpError(400, 'file is required');
    }
    const body = createProjectSchema.parse(req.body);

    const fileHash = sha256Hex(req.file.buffer);
    const storedFileName = `${Date.now()}-${req.file.originalname}`;
    const storagePath = path.join(env.UPLOAD_DIR, storedFileName);
    fs.writeFileSync(storagePath, req.file.buffer);

    const chain = getBlockchainService();
    const onChain = await chain.registerOwnership({
      projectId: 'pending', // not yet known - the Mongo _id is assigned below
      fileHash,
      ownerAddress: req.user!.walletAddress,
    });

    const project = await Project.create({
      owner: req.user!._id,
      title: body.title,
      description: body.description,
      fileName: req.file.originalname,
      fileHash,
      storagePath,
      tags: body.tags,
      visibility: body.visibility,
      ownershipProof: {
        onChainId: onChain.onChainId,
        txHash: onChain.txHash,
        blockNumber: onChain.blockNumber,
        registeredAt: new Date(),
      },
    });

    res.status(201).json({ project });
  }),
);

router.get(
  '/mine',
  requireAuth,
  requireRole('student'),
  asyncHandler(async (req, res) => {
    const projects = await Project.find({ owner: req.user!._id }).sort({ createdAt: -1 });
    res.json({ projects });
  }),
);

router.get(
  '/:id',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const project = await Project.findById(req.params.id);
    if (!project) {
      throw new HttpError(404, 'Project not found');
    }
    if (project.visibility === 'private') {
      const isOwner = req.user && req.user._id.toString() === project.owner.toString();
      if (!isOwner) {
        throw new HttpError(404, 'Project not found');
      }
    }
    res.json({ project });
  }),
);

router.get(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { tag, q } = req.query as { tag?: string; q?: string };

    const filter: Record<string, unknown> = {};
    const visibilityOr: Record<string, unknown>[] = [{ visibility: 'public' }];
    if (req.user) {
      visibilityOr.push({ owner: req.user._id });
    }
    filter.$or = visibilityOr;

    if (tag) {
      filter.tags = tag;
    }
    if (q) {
      const regex = new RegExp(q, 'i');
      filter.$and = [{ $or: [{ title: regex }, { description: regex }] }];
    }

    const projects = await Project.find(filter).sort({ createdAt: -1 });
    res.json({ projects });
  }),
);

export default router;
