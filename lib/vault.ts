/**
 * Passphrase-encrypted account vault.
 *
 * The account key is encrypted in the browser (PBKDF2-SHA256 → AES-256-GCM)
 * before it is written to the recovery file, so the file on its own is
 * useless. Neither the passphrase nor the derived key ever leaves the device;
 * the server keeps only the hash of the account key, as before.
 */

export const VAULT_FORMAT = "veil-vault";
export const VAULT_VERSION = 1;
export const MIN_PASSPHRASE_LENGTH = 10;
/** OWASP 2023 guidance for PBKDF2-HMAC-SHA256. */
export const DEFAULT_ITERATIONS = 600_000;
const MIN_ITERATIONS = 100_000;
const MAX_ITERATIONS = 10_000_000;
const ACCOUNT_KEY_PREFIX = "veil_acct_";

export interface VaultFile {
  format: typeof VAULT_FORMAT;
  version: typeof VAULT_VERSION;
  kdf: { name: "PBKDF2"; hash: "SHA-256"; iterations: number; salt: string };
  cipher: { name: "AES-GCM"; iv: string };
  ciphertext: string;
  createdAt: string;
}

export class VaultError extends Error {}

const enc = new TextEncoder();
const AAD = enc.encode(`${VAULT_FORMAT}/${VAULT_VERSION}`);

function toB64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromB64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", enc.encode(passphrase.normalize("NFKC")), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

export function passphraseProblem(passphrase: string, confirm?: string): string | null {
  if (passphrase.length < MIN_PASSPHRASE_LENGTH) return `Use at least ${MIN_PASSPHRASE_LENGTH} characters.`;
  if (confirm !== undefined && passphrase !== confirm) return "The passphrases don't match.";
  return null;
}

export async function sealVault(accountKey: string, passphrase: string, iterations = DEFAULT_ITERATIONS): Promise<VaultFile> {
  const problem = passphraseProblem(passphrase);
  if (problem) throw new VaultError(problem);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, iterations);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: AAD }, key, enc.encode(accountKey));
  return {
    format: VAULT_FORMAT,
    version: VAULT_VERSION,
    kdf: { name: "PBKDF2", hash: "SHA-256", iterations, salt: toB64(salt) },
    cipher: { name: "AES-GCM", iv: toB64(iv) },
    ciphertext: toB64(new Uint8Array(ct)),
    createdAt: new Date().toISOString(),
  };
}

/** Parse untrusted file contents. Returns null when it isn't a vault file at all. */
export function parseVaultFile(text: string): VaultFile | null {
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    return null;
  }
  const f = v as Partial<VaultFile> | null;
  if (!f || f.format !== VAULT_FORMAT) return null;
  if (f.version !== VAULT_VERSION) throw new VaultError("This vault file was made by a newer version of the app.");
  const ok =
    f.kdf?.name === "PBKDF2" &&
    f.kdf.hash === "SHA-256" &&
    Number.isInteger(f.kdf.iterations) &&
    f.kdf.iterations >= MIN_ITERATIONS &&
    f.kdf.iterations <= MAX_ITERATIONS &&
    typeof f.kdf.salt === "string" &&
    f.cipher?.name === "AES-GCM" &&
    typeof f.cipher.iv === "string" &&
    typeof f.ciphertext === "string" &&
    f.ciphertext.length < 4096;
  if (!ok) throw new VaultError("This vault file is damaged.");
  return f as VaultFile;
}

export async function openVault(file: VaultFile, passphrase: string): Promise<string> {
  let plain: ArrayBuffer;
  try {
    const key = await deriveKey(passphrase, fromB64(file.kdf.salt), file.kdf.iterations);
    plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(file.cipher.iv), additionalData: AAD }, key, fromB64(file.ciphertext));
  } catch {
    throw new VaultError("Wrong passphrase, or the file has been changed.");
  }
  const accountKey = new TextDecoder().decode(plain);
  if (!accountKey.startsWith(ACCOUNT_KEY_PREFIX)) throw new VaultError("This vault doesn't contain an account key.");
  return accountKey;
}

/** Pull a plain account key out of pasted text or an old .txt recovery file. */
export function findPlainAccountKey(text: string): string | null {
  const m = new RegExp(`${ACCOUNT_KEY_PREFIX}[A-Za-z0-9_-]{16,}`).exec(text);
  return m ? m[0] : null;
}
