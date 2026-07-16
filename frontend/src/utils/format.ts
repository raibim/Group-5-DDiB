/**
 * Minimal wei -> ETH formatter (no ethers dependency in the frontend).
 * Handles arbitrarily large integer strings using BigInt.
 */
export function weiToEth(wei: string | null | undefined): string {
  if (!wei) return '0';
  try {
    const value = BigInt(wei);
    const whole = value / 1_000_000_000_000_000_000n;
    const frac = value % 1_000_000_000_000_000_000n;
    const fracStr = frac.toString().padStart(18, '0').replace(/0+$/, '');
    return fracStr ? `${whole}.${fracStr}` : whole.toString();
  } catch {
    return wei;
  }
}

export function shortenAddress(address: string | undefined | null): string {
  if (!address) return '-';
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function shortenHash(hash: string | undefined | null): string {
  if (!hash) return '-';
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
}
