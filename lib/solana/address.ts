import bs58 from "bs58";

const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]+$/;

/** Decode a base58 string, returning null instead of throwing. */
export function tryDecodeBase58(value: string): Uint8Array | null {
  if (!BASE58_RE.test(value)) return null;
  try {
    return bs58.decode(value);
  } catch {
    return null;
  }
}

/** True when the string is a base58-encoded 32-byte key (wallet, mint, program…). */
export function isBase58PublicKey(value: string): boolean {
  if (value.length < 32 || value.length > 44) return false;
  return tryDecodeBase58(value)?.length === 32;
}

/** True when the string is a base58-encoded 64-byte value (tx signature or secret key). */
export function isBase58Signature64(value: string): boolean {
  if (value.length < 80 || value.length > 90) return false;
  return tryDecodeBase58(value)?.length === 64;
}

export function shortAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 1) return address;
  return `${address.slice(0, chars)}…${address.slice(-chars)}`;
}
