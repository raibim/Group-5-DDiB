import request from 'supertest';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';

jest.mock('../src/models/User', () => {
  const actual = jest.requireActual('../src/models/User');
  return {
    ...actual,
    User: {
      findOne: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
    },
  };
});

jest.mock('../src/models/Project', () => {
  const actual = jest.requireActual('../src/models/Project');
  return {
    ...actual,
    Project: {
      find: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
    },
  };
});

jest.mock('../src/services/blockchain', () => ({
  getBlockchainService: jest.fn(),
}));

import { User } from '../src/models/User';
import { Project } from '../src/models/Project';
import { getBlockchainService } from '../src/services/blockchain';
import { createApp } from '../src/app';

const mockedUser = User as unknown as { findById: jest.Mock };
const mockedProject = Project as unknown as { find: jest.Mock; findById: jest.Mock; create: jest.Mock };
const mockedGetBlockchainService = getBlockchainService as jest.Mock;

function makeStudentUser() {
  return {
    _id: new Types.ObjectId(),
    email: 'student@example.com',
    role: 'student',
    name: 'Ada Lovelace',
    walletAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    createdAt: new Date(),
  };
}

function tokenFor(user: { _id: Types.ObjectId; role: string }) {
  return jwt.sign({ sub: user._id.toString(), role: user.role }, 'test-secret');
}

describe('Project routes', () => {
  const app = createApp();

  it('rejects project creation with no file attached', async () => {
    const student = makeStudentUser();
    mockedUser.findById.mockResolvedValue(student);

    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${tokenFor(student)}`)
      .field('title', 'My Project')
      .field('description', 'A cool project');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/file is required/i);
  });

  it('rejects project creation from a non-student role', async () => {
    const company = { ...makeStudentUser(), role: 'company' };
    mockedUser.findById.mockResolvedValue(company);

    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${tokenFor(company)}`)
      .field('title', 'My Project')
      .field('description', 'A cool project')
      .attach('file', Buffer.from('hello world'), 'project.txt');

    expect(res.status).toBe(403);
  });

  it('creates a project, registers ownership on-chain, and stores the resulting proof', async () => {
    const student = makeStudentUser();
    mockedUser.findById.mockResolvedValue(student);

    const registerOwnership = jest.fn().mockResolvedValue({
      onChainId: 1,
      txHash: '0xabc123',
      blockNumber: 42,
    });
    mockedGetBlockchainService.mockReturnValue({ registerOwnership });

    const createdProject = {
      _id: new Types.ObjectId(),
      owner: student._id,
      title: 'My Project',
      description: 'A cool project',
      fileName: 'project.txt',
      fileHash: 'deadbeef',
      storagePath: 'uploads/project.txt',
      tags: [],
      visibility: 'public',
      ownershipProof: { onChainId: 1, txHash: '0xabc123', blockNumber: 42, registeredAt: new Date() },
    };
    mockedProject.create.mockResolvedValue(createdProject);

    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${tokenFor(student)}`)
      .field('title', 'My Project')
      .field('description', 'A cool project')
      .field('visibility', 'public')
      .attach('file', Buffer.from('hello world'), 'project.txt');

    expect(res.status).toBe(201);
    expect(registerOwnership).toHaveBeenCalledWith(
      expect.objectContaining({ ownerAddress: student.walletAddress }),
    );
    expect(res.body.project.ownershipProof.txHash).toBe('0xabc123');
  });

  it('lists public projects for GET /api/projects', async () => {
    mockedProject.find.mockReturnValue({
      sort: jest.fn().mockResolvedValue([{ title: 'Public one', visibility: 'public' }]),
    });

    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(200);
    expect(res.body.projects).toHaveLength(1);
  });
});
