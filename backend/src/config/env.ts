import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

function optional(name: string, fallback: string): string {
  const v = process.env[name];
  return v && v.length > 0 ? v : fallback;
}

export const env = {
  NODE_ENV: optional('NODE_ENV', 'development'),
  PORT: parseInt(optional('PORT', '4000'), 10),
  MONGODB_URI: optional('MONGODB_URI', 'mongodb://127.0.0.1:27017/innovchain'),
  JWT_SECRET: optional('JWT_SECRET', 'dev-secret-change-me'),
  CORS_ORIGIN: optional('CORS_ORIGIN', 'http://localhost:5173'),

  CHAIN_MODE: optional('CHAIN_MODE', 'local') as 'local' | 'testnet',
  RPC_URL: optional('RPC_URL', 'http://127.0.0.1:8545'),
  OPERATOR_PRIVATE_KEY: optional(
    'OPERATOR_PRIVATE_KEY',
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
  ),
  OWNERSHIP_REGISTRY_ADDRESS: optional('OWNERSHIP_REGISTRY_ADDRESS', ''),
  LICENSE_NFT_ADDRESS: optional('LICENSE_NFT_ADDRESS', ''),
  UNIVERSITY_WALLET_ADDRESS: optional(
    'UNIVERSITY_WALLET_ADDRESS',
    '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  ),
  PLATFORM_WALLET_ADDRESS: optional(
    'PLATFORM_WALLET_ADDRESS',
    '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
  ),

  UPLOAD_DIR: path.isAbsolute(optional('UPLOAD_DIR', 'uploads'))
    ? optional('UPLOAD_DIR', 'uploads')
    : path.join(__dirname, '..', '..', optional('UPLOAD_DIR', 'uploads')),

  // Repo root, used to locate contracts/deployments/<network>.json as a fallback for the
  // registry address when OWNERSHIP_REGISTRY_ADDRESS is not set.
  REPO_ROOT: path.join(__dirname, '..', '..', '..'),
};
