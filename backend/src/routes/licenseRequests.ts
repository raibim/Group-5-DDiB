import { Router } from 'express';
import { ethers } from 'ethers';
import { Project } from '../models/Project';
import { LicenseRequest } from '../models/LicenseRequest';
import { User } from '../models/User';
import { requireAuth, requireRole } from '../middleware/auth';
import { createLicenseRequestSchema } from '../validation/schemas';
import { asyncHandler } from '../utils/asyncHandler';
import { HttpError } from '../middleware/errorHandler';
import { getBlockchainService } from '../services/blockchain';
import { env } from '../config/env';

const router = Router();

const STUDENT_BPS = 1000; // 10%
const UNIVERSITY_BPS = 500; // 5%
// companyBps = 10000 - STUDENT_BPS - UNIVERSITY_BPS = 8500 (85%), derived on-chain.

// POST /projects/:id/license-requests
router.post(
  '/projects/:id/license-requests',
  requireAuth,
  requireRole('company'),
  asyncHandler(async (req, res) => {
    const project = await Project.findById(req.params.id);
    if (!project) {
      throw new HttpError(404, 'Project not found');
    }

    const body = createLicenseRequestSchema.parse(req.body);
    const priceWei = ethers.parseEther(body.priceEth.toString()).toString();

    const licenseRequest = await LicenseRequest.create({
      project: project._id,
      company: req.user!._id,
      durationMonths: body.durationMonths,
      commercialUse: body.commercialUse,
      priceWei,
      status: 'pending',
    });

    res.status(201).json({ licenseRequest });
  }),
);

// GET /license-requests/mine
router.get(
  '/license-requests/mine',
  requireAuth,
  requireRole('student', 'company'),
  asyncHandler(async (req, res) => {
    let licenseRequests;
    if (req.user!.role === 'company') {
      licenseRequests = await LicenseRequest.find({ company: req.user!._id }).sort({
        createdAt: -1,
      });
    } else {
      const ownProjects = await Project.find({ owner: req.user!._id }, { _id: 1 });
      const myProjectIds = ownProjects.map((p) => p._id);
      licenseRequests = await LicenseRequest.find({ project: { $in: myProjectIds } }).sort({
        createdAt: -1,
      });
    }
    res.json({ licenseRequests });
  }),
);

// GET /license-requests/:id
router.get(
  '/license-requests/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const licenseRequest = await LicenseRequest.findById(req.params.id);
    if (!licenseRequest) {
      throw new HttpError(404, 'License request not found');
    }
    res.json({ licenseRequest });
  }),
);

// POST /license-requests/:id/accept
router.post(
  '/license-requests/:id/accept',
  requireAuth,
  requireRole('student'),
  asyncHandler(async (req, res) => {
    const licenseRequest = await LicenseRequest.findById(req.params.id);
    if (!licenseRequest) {
      throw new HttpError(404, 'License request not found');
    }
    if (licenseRequest.status !== 'pending') {
      throw new HttpError(400, `Cannot accept a request with status "${licenseRequest.status}"`);
    }

    const project = await Project.findById(licenseRequest.project);
    if (!project) {
      throw new HttpError(404, 'Project not found');
    }
    if (project.owner.toString() !== req.user!._id.toString()) {
      throw new HttpError(403, 'Only the project owner may accept this request');
    }

    const companyUser = await User.findById(licenseRequest.company);
    if (!companyUser) {
      throw new HttpError(404, 'Requesting company not found');
    }

    const chain = getBlockchainService();
    const deployed = await chain.deployLicensingContract({
      studentAddress: req.user!.walletAddress,
      universityAddress: env.UNIVERSITY_WALLET_ADDRESS,
      companyAddress: companyUser.walletAddress,
      studentBps: STUDENT_BPS,
      universityBps: UNIVERSITY_BPS,
      priceWei: licenseRequest.priceWei,
    });

    licenseRequest.contract = {
      address: deployed.address,
      studentAddress: req.user!.walletAddress,
      universityAddress: env.UNIVERSITY_WALLET_ADDRESS,
      companyAddress: companyUser.walletAddress,
      studentBps: STUDENT_BPS,
      universityBps: UNIVERSITY_BPS,
      companyBps: 10000 - STUDENT_BPS - UNIVERSITY_BPS,
      deployTxHash: deployed.deployTxHash,
    };
    licenseRequest.status = 'accepted';
    await licenseRequest.save();

    res.json({ licenseRequest });
  }),
);

// POST /license-requests/:id/reject
router.post(
  '/license-requests/:id/reject',
  requireAuth,
  requireRole('student'),
  asyncHandler(async (req, res) => {
    const licenseRequest = await LicenseRequest.findById(req.params.id);
    if (!licenseRequest) {
      throw new HttpError(404, 'License request not found');
    }
    if (licenseRequest.status !== 'pending') {
      throw new HttpError(400, `Cannot reject a request with status "${licenseRequest.status}"`);
    }
    const project = await Project.findById(licenseRequest.project);
    if (!project || project.owner.toString() !== req.user!._id.toString()) {
      throw new HttpError(403, 'Only the project owner may reject this request');
    }
    licenseRequest.status = 'rejected';
    await licenseRequest.save();
    res.json({ licenseRequest });
  }),
);

// POST /license-requests/:id/fund
router.post(
  '/license-requests/:id/fund',
  requireAuth,
  requireRole('company'),
  asyncHandler(async (req, res) => {
    const licenseRequest = await LicenseRequest.findById(req.params.id);
    if (!licenseRequest) {
      throw new HttpError(404, 'License request not found');
    }
    if (licenseRequest.company.toString() !== req.user!._id.toString()) {
      throw new HttpError(403, 'Only the requesting company may fund this request');
    }
    if (licenseRequest.status !== 'accepted') {
      throw new HttpError(400, `Cannot fund a request with status "${licenseRequest.status}"`);
    }
    if (!licenseRequest.contract) {
      throw new HttpError(400, 'License request has no deployed contract yet');
    }

    const chain = getBlockchainService();
    const funded = await chain.fundContract({
      contractAddress: licenseRequest.contract.address,
      amountWei: licenseRequest.priceWei,
      fromRole: 'company',
      fromAddress: licenseRequest.contract.companyAddress,
    });

    licenseRequest.funding = { txHash: funded.txHash, amountWei: licenseRequest.priceWei };
    licenseRequest.status = 'funded';
    await licenseRequest.save();

    res.json({ licenseRequest });
  }),
);

// POST /license-requests/:id/release
router.post(
  '/license-requests/:id/release',
  requireAuth,
  requireRole('student', 'company'),
  asyncHandler(async (req, res) => {
    const licenseRequest = await LicenseRequest.findById(req.params.id);
    if (!licenseRequest) {
      throw new HttpError(404, 'License request not found');
    }
    if (licenseRequest.status !== 'funded') {
      throw new HttpError(400, `Cannot release a request with status "${licenseRequest.status}"`);
    }
    if (!licenseRequest.contract) {
      throw new HttpError(400, 'License request has no deployed contract yet');
    }

    const isCompany = licenseRequest.company.toString() === req.user!._id.toString();
    let isStudent = false;
    if (!isCompany) {
      const project = await Project.findById(licenseRequest.project);
      isStudent = !!project && project.owner.toString() === req.user!._id.toString();
    }
    if (!isCompany && !isStudent) {
      throw new HttpError(403, 'Only the student or company party may release funds');
    }

    const fromAddress = isCompany
      ? licenseRequest.contract.companyAddress
      : licenseRequest.contract.studentAddress;

    const chain = getBlockchainService();
    const released = await chain.releaseContract({
      contractAddress: licenseRequest.contract.address,
      fromAddress,
    });

    licenseRequest.release = {
      txHash: released.txHash,
      studentAmountWei: released.studentAmountWei,
      universityAmountWei: released.universityAmountWei,
      companyAmountWei: released.companyAmountWei,
    };
    licenseRequest.status = 'released';
    await licenseRequest.save();

    res.json({ licenseRequest });
  }),
);

export default router;
