import request from 'supertest';
import bcrypt from 'bcryptjs';
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

// eslint-disable-next-line @typescript-eslint/no-var-requires
import { User } from '../src/models/User';
import { createApp } from '../src/app';

const mockedUser = User as unknown as {
  findOne: jest.Mock;
  findById: jest.Mock;
  create: jest.Mock;
};

function makeFakeUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    _id: new Types.ObjectId(),
    email: 'student@example.com',
    passwordHash: bcrypt.hashSync('supersecret1', 10),
    role: 'student',
    name: 'Ada Lovelace',
    walletAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    createdAt: new Date(),
    ...overrides,
  };
}

describe('Auth routes', () => {
  const app = createApp();

  it('registers a new user and returns a token', async () => {
    mockedUser.findOne.mockResolvedValueOnce(null);
    const fakeUser = makeFakeUser();
    mockedUser.create.mockResolvedValueOnce(fakeUser);

    const res = await request(app).post('/api/auth/register').send({
      email: fakeUser.email,
      password: 'supersecret1',
      role: 'student',
      name: fakeUser.name,
      walletAddress: fakeUser.walletAddress,
    });

    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user.email).toBe(fakeUser.email);
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('rejects registration with an invalid wallet address', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'bad@example.com',
      password: 'supersecret1',
      role: 'student',
      name: 'Bad Wallet',
      walletAddress: 'not-an-address',
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toEqual(expect.any(String));
    expect(mockedUser.create).not.toHaveBeenCalled();
  });

  it('rejects registration when the email is already taken', async () => {
    mockedUser.findOne.mockResolvedValueOnce(makeFakeUser());

    const res = await request(app).post('/api/auth/register').send({
      email: 'student@example.com',
      password: 'supersecret1',
      role: 'student',
      name: 'Ada Lovelace',
      walletAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    });

    expect(res.status).toBe(409);
  });

  it('logs in with correct credentials and rejects incorrect ones', async () => {
    const fakeUser = makeFakeUser();
    mockedUser.findOne.mockResolvedValueOnce(fakeUser);

    const ok = await request(app)
      .post('/api/auth/login')
      .send({ email: fakeUser.email, password: 'supersecret1' });
    expect(ok.status).toBe(200);
    expect(ok.body.token).toEqual(expect.any(String));

    mockedUser.findOne.mockResolvedValueOnce(fakeUser);
    const bad = await request(app)
      .post('/api/auth/login')
      .send({ email: fakeUser.email, password: 'wrong-password' });
    expect(bad.status).toBe(401);
  });

  it('GET /auth/me requires a valid bearer token', async () => {
    const noAuth = await request(app).get('/api/auth/me');
    expect(noAuth.status).toBe(401);

    const fakeUser = makeFakeUser();
    mockedUser.findOne.mockResolvedValueOnce(null);
    mockedUser.create.mockResolvedValueOnce(fakeUser);
    const registerRes = await request(app).post('/api/auth/register').send({
      email: fakeUser.email,
      password: 'supersecret1',
      role: 'student',
      name: fakeUser.name,
      walletAddress: fakeUser.walletAddress,
    });
    const token = registerRes.body.token;

    mockedUser.findById.mockResolvedValueOnce(fakeUser);
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(fakeUser.email);
  });
});
