import { Router } from 'express';
import { ethers } from 'ethers';
import { Project } from '../models/Project';
import { LicenseRequest } from '../models/LicenseRequest';
import { User } from '../models/User';
import { requireAuth, requireRole } from '../middleware/auth';
import { createLicenseRequestSchema, sublicenseRequestSchema } from '../validation/schemas';
import { asyncHandler } from '../utils/asyncHandler';
import { HttpError } from '../middleware/errorHandler';
import { getBlockchainService } from '../services/blockchain';
import { env } from '../config/env';

const router = Router();

// Sale model: the company pays the FULL agreed price, which is then split three ways.
const STUDENT_BPS = 8500; // 85%
const UNIVERSITY_BPS = 500; // 5%
const PLATFORM_BPS = 1000; // 10%

// Resale royalty: if this license is later sublicensed, only this fraction of the resale
// price is split out to student/university/platform - NOT the same 85/5/10 as the original
// sale. Reapplying a 100%-of-price split on every resale would leave the reselling company
// with $0 profit no matter what it resells for, which defeats the point of a resale. This
// rate is deliberately smaller and tunable independent of the original sale split, split
// proportionally across student:university:platform in the same 85:5:10 ratio.
const RESALE_ROYALTY_BPS = 1000; // 10% of any future resale price; the remaining 90% goes to
// the reselling company - i.e. its actual resale profit.

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

    // Sale model: the company escrows the FULL agreed price. release() then splits it
    // 85%/5%/10% across student/university/platform. See LicensingRoyalty.sol.
    const chain = getBlockchainService();
    const deployed = await chain.deployLicensingContract({
      studentAddress: req.user!.walletAddress,
      universityAddress: env.UNIVERSITY_WALLET_ADDRESS,
      companyAddress: companyUser.walletAddress,
      platformAddress: env.PLATFORM_WALLET_ADDRESS,
      studentBps: STUDENT_BPS,
      universityBps: UNIVERSITY_BPS,
      platformBps: PLATFORM_BPS,
      priceWei: licenseRequest.priceWei,
    });

    licenseRequest.contract = {
      address: deployed.address,
      studentAddress: req.user!.walletAddress,
      universityAddress: env.UNIVERSITY_WALLET_ADDRESS,
      companyAddress: companyUser.walletAddress,
      platformAddress: env.PLATFORM_WALLET_ADDRESS,
      studentBps: STUDENT_BPS,
      universityBps: UNIVERSITY_BPS,
      platformBps: PLATFORM_BPS,
      priceWei: licenseRequest.priceWei,
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
      amountWei: licenseRequest.contract.priceWei,
      fromRole: 'company',
      fromAddress: licenseRequest.contract.companyAddress,
    });

    licenseRequest.funding = { txHash: funded.txHash, amountWei: licenseRequest.contract.priceWei };
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
      platformAmountWei: released.platformAmountWei,
    };
    licenseRequest.status = 'released';

    // Mint the license NFT to the company now that the sale has actually completed - holding
    // the token IS holding the license from here on. The token carries its OWN (smaller)
    // resale-royalty split, proportional to the original sale's 85:5:10 ratio but scaled down
    // to RESALE_ROYALTY_BPS - not a re-application of the full sale split.
    const resaleStudentBps = Math.floor((STUDENT_BPS * RESALE_ROYALTY_BPS) / 10000);
    const resaleUniversityBps = Math.floor((UNIVERSITY_BPS * RESALE_ROYALTY_BPS) / 10000);
    const resalePlatformBps = RESALE_ROYALTY_BPS - resaleStudentBps - resaleUniversityBps;

    const minted = await chain.mintLicense({
      toAddress: licenseRequest.contract.companyAddress,
      // A short numeric tag for the on-chain event log only (not the Mongo _id itself, which
      // isn't numeric) - last 8 hex chars of the ObjectId, parsed as a uint.
      sourceLicenseRequestId: parseInt(licenseRequest._id.toString().slice(-8), 16),
      studentAddress: licenseRequest.contract.studentAddress,
      universityAddress: licenseRequest.contract.universityAddress,
      platformAddress: licenseRequest.contract.platformAddress,
      studentBps: resaleStudentBps,
      universityBps: resaleUniversityBps,
      platformBps: resalePlatformBps,
    });
    licenseRequest.licenseNft = {
      tokenId: minted.tokenId,
      mintTxHash: minted.mintTxHash,
      studentBps: resaleStudentBps,
      universityBps: resaleUniversityBps,
      platformBps: resalePlatformBps,
    };

    await licenseRequest.save();

    res.json({ licenseRequest });
  }),
);

// POST /license-requests/:id/sublicense
// The CURRENT holder (company) resells the license NFT to another registered company. The
// token's resale-royalty split (RESALE_ROYALTY_BPS, NOT the original 85/5/10 sale split) is
// enforced again automatically on the resale price - see LicenseNFT.sublicense().
router.post(
  '/license-requests/:id/sublicense',
  requireAuth,
  requireRole('company'),
  asyncHandler(async (req, res) => {
    const licenseRequest = await LicenseRequest.findById(req.params.id);
    if (!licenseRequest) {
      throw new HttpError(404, 'License request not found');
    }
    if (licenseRequest.company.toString() !== req.user!._id.toString()) {
      throw new HttpError(403, 'Only the current license holder may sublicense it');
    }
    if (licenseRequest.status !== 'released' || !licenseRequest.licenseNft || !licenseRequest.contract) {
      throw new HttpError(400, 'License request has no license NFT to sublicense yet');
    }

    const body = sublicenseRequestSchema.parse(req.body);
    const buyer = await User.findById(body.toCompanyId);
    if (!buyer || buyer.role !== 'company') {
      throw new HttpError(404, 'Target company not found');
    }
    if (buyer._id.toString() === req.user!._id.toString()) {
      throw new HttpError(400, 'Cannot sublicense to yourself');
    }

    const priceWei = ethers.parseEther(body.priceEth.toString()).toString();

    const chain = getBlockchainService();
    const result = await chain.sublicense({
      tokenId: licenseRequest.licenseNft.tokenId,
      fromAddress: req.user!.walletAddress,
      toAddress: buyer.walletAddress,
      priceWei,
    });

    licenseRequest.sublicenses.push({
      toCompany: buyer._id,
      toAddress: buyer.walletAddress,
      priceWei,
      txHash: result.txHash,
      studentAmountWei: result.studentAmountWei,
      universityAmountWei: result.universityAmountWei,
      platformAmountWei: result.platformAmountWei,
      sellerAmountWei: result.sellerAmountWei,
      createdAt: new Date(),
    });
    licenseRequest.company = buyer._id;
    await licenseRequest.save();

    res.json({ licenseRequest });
  }),
);

export default router;
