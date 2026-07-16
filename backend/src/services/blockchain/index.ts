import { env } from '../../config/env';
import { BlockchainService } from './types';
import { LocalChainService } from './localChainService';
import { TestnetChainService } from './testnetChainService';

export * from './types';

let cached: BlockchainService | undefined;

/** Lazily constructs the chain service on first use (not at import time) so that unit
 * tests can `jest.mock('../services/blockchain')` without ever touching a real provider,
 * and so route/module wiring doesn't fail just because a Hardhat node isn't running yet. */
export function getBlockchainService(): BlockchainService {
  if (!cached) {
    cached = env.CHAIN_MODE === 'testnet' ? new TestnetChainService() : new LocalChainService();
  }
  return cached;
}
