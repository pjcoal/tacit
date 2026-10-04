import { describe, expect, it } from "vitest";
import { findPlainAccountKey, openVault, parseVaultFile, passphraseProblem, sealVault, VaultError } from "@/lib/vault";

const KEY = "veil_acct_" + "A".repeat(43);
const PASS = "correct horse battery";
const FAST = 100_000;

describe("account vault", () => {
  it("round-trips the account key through a JSON file", async () => {
    const file = await sealVault(KEY, PASS, FAST);
    const text = JSON.stringify(file);
    expect(text).not.toContain(KEY);
    expect(text).not.toContain(PASS);
    const parsed = parseVaultFile(text);
    expect(parsed).not.toBeNull();
    expect(await openVault(parsed!, PASS)).toBe(KEY);
  });

  it("uses a fresh salt and IV every time", async () => {
    const [a, b] = await Promise.all([sealVault(KEY, PASS, FAST), sealVault(KEY, PASS, FAST)]);
    expect(a.kdf.salt).not.toBe(b.kdf.salt);
    expect(a.cipher.iv).not.toBe(b.cipher.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it("rejects the wrong passphrase and tampered files", async () => {
    const file = await sealVault(KEY, PASS, FAST);
    await expect(openVault(file, "wrong passphrase!")).rejects.toBeInstanceOf(VaultError);
    const ct = atob(file.ciphertext);
    const flipped = btoa(String.fromCharCode(ct.charCodeAt(0) ^ 1) + ct.slice(1));
    await expect(openVault({ ...file, ciphertext: flipped }, PASS)).rejects.toThrow(/passphrase|changed/);
  });

  it("requires a reasonable passphrase", async () => {
    expect(passphraseProblem("short")).toMatch(/10/);
    expect(passphraseProblem(PASS, PASS + "x")).toMatch(/match/);
    expect(passphraseProblem(PASS, PASS)).toBeNull();
    await expect(sealVault(KEY, "short", FAST)).rejects.toBeInstanceOf(VaultError);
  });

  it("validates untrusted vault files", () => {
    expect(parseVaultFile("not json")).toBeNull();
    expect(parseVaultFile(JSON.stringify({ hello: 1 }))).toBeNull();
    const base = { format: "veil-vault", version: 1, kdf: { name: "PBKDF2", hash: "SHA-256", iterations: 10, salt: "AA==" }, cipher: { name: "AES-GCM", iv: "AA==" }, ciphertext: "AA==" };
    expect(() => parseVaultFile(JSON.stringify(base))).toThrow(/damaged/); // iterations too low to be safe
    expect(() => parseVaultFile(JSON.stringify({ ...base, version: 2 }))).toThrow(/newer/);
  });

  it("still finds plain keys from old recovery files", () => {
    expect(findPlainAccountKey(`Veil account recovery key\n\n${KEY}\n\nKeep this file private.`)).toBe(KEY);
    expect(findPlainAccountKey("nothing here")).toBeNull();
  });
});
