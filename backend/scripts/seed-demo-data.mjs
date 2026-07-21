// Seeds the marketplace with demo projects across the three categories (final-year,
// hackathon, summer-school) by driving the real running API - every project gets genuine
// on-chain ownership anchoring via OwnershipRegistry, not fabricated data.
//
// Usage: node backend/scripts/seed-demo-data.mjs
// Requires: Mongo, a local Hardhat node (deployed), and the backend all already running,
// per the root README's "Running the full stack locally" steps.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:4000/api';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');

// Well-known local Hardhat dev account addresses (accounts #2-#11), pre-funded on any
// fresh `npx hardhat node`. Reused here only as demo wallet addresses for seed users.
const DEV_ADDRESSES = [
  '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
  '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
  '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
  '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc',
  '0x976EA74026E726554dB657fA54763abd0C3a0aa9',
  '0x14dC79964da2C08b23698B3D3cc7Ca32193d9955',
  '0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f',
  '0xa0Ee7A142d267C1f36714E4a8F75612F20a79720',
  '0xBcd4042DE499D14e55001CcbB24a551F3b954096',
  '0x71bE63f3384f5fb98995898A86B02Fb2426c5788',
];

const students = [
  { key: 'innovchain', email: 'innovchain.team@ddib.dev', name: 'InnovChain Team' },
  { key: 'group5', email: 'group5@ddib.dev', name: 'Group 5' },
  { key: 'zurichlights', email: 'zurichlights@ddib.dev', name: 'Zurich Lights' },
  { key: 'votecrypt', email: 'votecrypt@ddib.dev', name: 'VoteCrypt' },
  { key: 'fy1', email: 'student.fy1@ddib.dev', name: 'Priya Nkemelu' },
  { key: 'fy2', email: 'student.fy2@ddib.dev', name: 'Tomasz Wieczorek' },
  { key: 'fy3', email: 'student.fy3@ddib.dev', name: 'Sena Ohashi' },
  { key: 'hack1', email: 'student.hack1@ddib.dev', name: 'Diego Farfan' },
  { key: 'hack2', email: 'student.hack2@ddib.dev', name: 'Lea Brantner' },
  { key: 'hack3', email: 'student.hack3@ddib.dev', name: 'Musa Abiodun' },
];

const README_PATH = path.join(REPO_ROOT, 'README.md');

function textFile(name, content) {
  return new File([content], name, { type: 'text/plain' });
}

const projects = [
  {
    owner: 'innovchain',
    category: 'summer-school',
    title: 'InnovChain',
    description:
      'AI-powered blockchain innovation marketplace connecting student inventors, universities, and companies. On-chain proof of ownership, semantic AI matching, and automated licensing/sale smart contracts (85% student / 5% university / 10% platform) replace slow, trust-based commercialization deals. This is the InnovChain platform itself, submitted as our Group 5 entry for the 7th International Summer School - Deep Dive into Blockchain 2026 (UZH).',
    tags: ['Blockchain', 'AI', 'Marketplace', 'Licensing'],
    file: () => {
      const content = readFileSync(README_PATH, 'utf-8');
      return textFile('InnovChain-README.md', content);
    },
  },
  {
    owner: 'group5',
    category: 'summer-school',
    title: 'Group 5 - DDiB Final Project',
    description:
      "Group 5's submission for the S4 Final Group Project of the 7th International Summer School - Deep Dive into Blockchain 2026, University of Zurich (Blockchain & DLT Group, UZH Blockchain Center). The brief: develop a blockchain-based solution across its business/economics, technology, and governance pillars in two weeks. Our answer is InnovChain - see the linked project.",
    tags: ['DDiB26', 'UZH', 'Blockchain', 'Governance'],
    file: () =>
      textFile(
        'group5-abstract.txt',
        'Group 5 - Deep Dive into Blockchain 2026\nSupervised by the UZH Blockchain & DLT Research Group.\nProject: InnovChain - AI-powered blockchain innovation marketplace.\n',
      ),
  },
  {
    owner: 'zurichlights',
    category: 'summer-school',
    title: 'Zurich Lights - SBB Token',
    description:
      'Blockchain for a sustainable future: a soulbound SBB transit token minted on-demand each time a user buys tickets or travelcards, with zero initial supply. Tokens can only be transferred by their original owner and are burned automatically through a 365-day decay process, discouraging speculation while rewarding real transit usage.',
    tags: ['Sustainability', 'Blockchain', 'Mobility'],
    file: () =>
      textFile(
        'zurich-lights.txt',
        'Zurich Lights - Blockchain for sustainable future.\nSBB Token: initial supply 0, on-demand minting, soulbound, 365-day burn.\n',
      ),
  },
  {
    owner: 'votecrypt',
    category: 'summer-school',
    title: 'VoteCrypt',
    description:
      'VoteCrypt is building a secure, transparent, and accessible voting platform using blockchain technology. Its mission is to revolutionize the voting process, ensuring every vote is protected, counted accurately, and independently verifiable by all participants - strengthening governance worldwide.',
    tags: ['Governance', 'Voting', 'Blockchain'],
    file: () =>
      textFile(
        'votecrypt.txt',
        'VoteCrypt - secure, transparent, accessible on-chain voting.\n',
      ),
  },
  {
    owner: 'fy1',
    category: 'final-year',
    title: 'Smart Campus Energy Grid',
    description:
      'A peer-to-peer renewable energy trading system for university campuses. IoT smart meters report generation and consumption on-chain, and a smart contract clears trades between buildings automatically, letting solar-rich buildings sell surplus energy directly to neighbors instead of the grid.',
    tags: ['IoT', 'Energy', 'Blockchain', 'Sustainability'],
    file: () => textFile('smart-campus-grid.txt', 'Smart Campus Energy Grid - final year project.\n'),
  },
  {
    owner: 'fy2',
    category: 'final-year',
    title: 'Autonomous Crop Health Drone',
    description:
      'An AI-powered drone system for early crop disease detection using multispectral imaging and a lightweight on-device classifier, designed for smallholder farms that cannot afford satellite monitoring subscriptions.',
    tags: ['AI', 'Agriculture', 'Robotics'],
    file: () => textFile('crop-health-drone.txt', 'Autonomous Crop Health Drone - final year project.\n'),
  },
  {
    owner: 'fy3',
    category: 'final-year',
    title: 'Decentralized Peer Tutoring Ledger',
    description:
      'A blockchain-based reputation and credit system for peer-to-peer academic tutoring: students earn verifiable, portable tutoring credits that can be redeemed for tutoring help from others, with disputes resolved by a lightweight on-chain reputation score.',
    tags: ['Blockchain', 'Education'],
    file: () => textFile('peer-tutoring-ledger.txt', 'Decentralized Peer Tutoring Ledger - final year project.\n'),
  },
  {
    owner: 'hack1',
    category: 'hackathon',
    title: '48-Hour Disaster Relief Coordinator',
    description:
      'A hackathon MVP built in 48 hours: coordinates relief-supply donations between NGOs and donors, with each delivery confirmation logged on-chain so donors can verify their contribution actually reached its destination.',
    tags: ['Blockchain', 'Humanitarian'],
    file: () => textFile('disaster-relief.txt', '48-Hour Disaster Relief Coordinator - hackathon project.\n'),
  },
  {
    owner: 'hack2',
    category: 'hackathon',
    title: 'MicroLend - Campus P2P Microloans',
    description:
      'A weekend-hackathon peer-to-peer microloan platform for students: lenders fund small short-term loans into a smart contract escrow, which releases repayments automatically according to agreed terms, without a bank intermediary.',
    tags: ['DeFi', 'Blockchain'],
    file: () => textFile('microlend.txt', 'MicroLend - campus P2P microloans - hackathon project.\n'),
  },
  {
    owner: 'hack3',
    category: 'hackathon',
    title: 'EchoVote',
    description:
      'An anonymous on-chain polling app for live event Q&A and audience voting, built in 24 hours. Votes are hashed client-side before submission so results are verifiable on-chain without exposing who voted for what.',
    tags: ['Blockchain', 'Voting'],
    file: () => textFile('echovote.txt', 'EchoVote - anonymous on-chain polling - hackathon project.\n'),
  },
];

async function registerStudent(student) {
  const walletAddress = DEV_ADDRESSES[students.indexOf(student) % DEV_ADDRESSES.length];
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: student.email,
      password: 'password123',
      role: 'student',
      name: student.name,
      walletAddress,
    }),
  });
  if (res.ok) {
    const { token } = await res.json();
    return token;
  }
  // already registered - log in instead
  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: student.email, password: 'password123' }),
  });
  if (!loginRes.ok) {
    throw new Error(`Failed to register or log in ${student.email}: ${await loginRes.text()}`);
  }
  const { token } = await loginRes.json();
  return token;
}

async function uploadProject(token, project) {
  const form = new FormData();
  form.append('file', project.file());
  form.append('title', project.title);
  form.append('description', project.description);
  form.append('category', project.category);
  project.tags.forEach((tag) => form.append('tags[]', tag));
  form.append('visibility', 'public');

  const res = await fetch(`${API_BASE}/projects`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`Failed to upload "${project.title}": ${await res.text()}`);
  }
  const { project: created } = await res.json();
  return created;
}

async function main() {
  const tokensByOwner = {};
  for (const student of students) {
    process.stdout.write(`Registering/logging in ${student.email}... `);
    tokensByOwner[student.key] = await registerStudent(student);
    console.log('ok');
  }

  for (const project of projects) {
    process.stdout.write(`Uploading "${project.title}" (${project.category})... `);
    const created = await uploadProject(tokensByOwner[project.owner], project);
    console.log(`ok - onChainId ${created.ownershipProof.onChainId}, tx ${created.ownershipProof.txHash}`);
  }

  console.log(`\nSeeded ${projects.length} projects across ${new Set(projects.map((p) => p.category)).size} categories.`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
