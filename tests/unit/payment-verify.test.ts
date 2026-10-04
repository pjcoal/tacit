import { describe, expect, it } from "vitest";
import { validatePaymentTransaction, type PaymentExpectation } from "@/lib/payments/verify";
import { key, parsedTx } from "./helpers";

const payer = key();
const treasury = key();
const reference = key();
const now = Date.now();
const window = { notBefore: new Date(now - 60_000), notAfter: new Date(now + 60_000) };

function solExpectation(over: Partial<PaymentExpectation> = {}): PaymentExpectation {
  return { kind: "SOL", payer, destination: treasury, minAmount: 1_000_000n, reference, ...window, ...over };
}

function solTx(over: { lamports?: number; to?: string; signer?: boolean; withRef?: boolean; err?: unknown; blockTime?: number; post?: number } = {}) {
  const to = over.to ?? treasury;
  const lamports = over.lamports ?? 1_000_000;
  const keys = [{ pubkey: payer, signer: over.signer ?? true }, { pubkey: to }, ...(over.withRef === false ? [] : [{ pubkey: reference }]), { pubkey: "11111111111111111111111111111111" }];
  return parsedTx({
    payer,
    keys,
    instructions: [{ program: "system", type: "transfer", info: { source: payer, destination: to, lamports } }],
    preBalances: [5_000_000_000, 10, 0, 1],
    postBalances: [5_000_000_000 - lamports - 5000, 10 + (over.post ?? lamports), 0, 1],
    err: over.err,
    blockTime: over.blockTime,
  });
}

describe("validatePaymentTransaction (SOL)", () => {
  it("accepts a correct transfer", () => {
    const r = validatePaymentTransaction(solTx(), solExpectation());
    expect(r).toMatchObject({ ok: true, amount: 1_000_000n });
  });

  it("rejects missing transactions and on-chain failures", () => {
    expect(validatePaymentTransaction(null, solExpectation()).ok).toBe(false);
    expect(validatePaymentTransaction(solTx({ err: { InstructionError: [0, "Custom"] } }), solExpectation())).toMatchObject({ ok: false, reason: /failed/ });
  });

  it("rejects a transfer to the wrong destination", () => {
    expect(validatePaymentTransaction(solTx({ to: key() }), solExpectation())).toMatchObject({ ok: false });
  });

  it("rejects underpayment", () => {
    expect(validatePaymentTransaction(solTx({ lamports: 999_999 }), solExpectation())).toMatchObject({ ok: false, reason: /lower/ });
  });

  it("rejects when the payer did not sign", () => {
    expect(validatePaymentTransaction(solTx({ signer: false }), solExpectation())).toMatchObject({ ok: false, reason: /sign/ });
  });

  it("rejects transactions without the intent reference (binds tx to one intent)", () => {
    expect(validatePaymentTransaction(solTx({ withRef: false }), solExpectation())).toMatchObject({ ok: false, reason: /reference/ });
  });

  it("rejects transactions outside the quote window", () => {
    const late = Math.floor((now + 10 * 60_000) / 1000);
    expect(validatePaymentTransaction(solTx({ blockTime: late }), solExpectation())).toMatchObject({ ok: false, reason: /expired/ });
    const early = Math.floor((now - 10 * 60_000) / 1000);
    expect(validatePaymentTransaction(solTx({ blockTime: early }), solExpectation())).toMatchObject({ ok: false, reason: /predates/ });
  });

  it("cross-checks the treasury balance change", () => {
    expect(validatePaymentTransaction(solTx({ post: 10 }), solExpectation())).toMatchObject({ ok: false, reason: /balance/ });
  });
});

describe("validatePaymentTransaction (SPL)", () => {
  const mint = key();
  const destAta = key();
  const srcAta = key();

  function splTx(over: { mint?: string; amount?: string; authority?: string; delta?: string } = {}) {
    const amount = over.amount ?? "25000000";
    return parsedTx({
      payer,
      keys: [{ pubkey: payer, signer: true }, { pubkey: srcAta }, { pubkey: destAta }, { pubkey: reference }],
      instructions: [
        {
          program: "spl-token",
          type: "transferChecked",
          info: { source: srcAta, destination: destAta, mint: over.mint ?? mint, authority: over.authority ?? payer, tokenAmount: { amount, decimals: 6 } },
        },
      ],
      preTokenBalances: [{ accountIndex: 2, mint, uiTokenAmount: { amount: "0", decimals: 6, uiAmount: 0, uiAmountString: "0" } }] as never,
      postTokenBalances: [{ accountIndex: 2, mint, uiTokenAmount: { amount: over.delta ?? amount, decimals: 6, uiAmount: 25, uiAmountString: "25" } }] as never,
    });
  }
  const exp = (): PaymentExpectation => ({ kind: "SPL", payer, destination: destAta, mint, minAmount: 25_000_000n, reference, ...window });

  it("accepts a correct transferChecked", () => {
    expect(validatePaymentTransaction(splTx(), exp())).toMatchObject({ ok: true, amount: 25_000_000n });
  });

  it("rejects the wrong mint", () => {
    expect(validatePaymentTransaction(splTx({ mint: key() }), exp()).ok).toBe(false);
  });

  it("rejects a transfer signed by someone else", () => {
    expect(validatePaymentTransaction(splTx({ authority: key() }), exp()).ok).toBe(false);
  });

  it("rejects when the treasury token balance didn't move", () => {
    expect(validatePaymentTransaction(splTx({ delta: "0" }), exp())).toMatchObject({ ok: false, reason: /balance/ });
  });
});

describe("validatePaymentTransaction (BURN)", () => {
  const mint = key();
  const payerAta = key();

  function burnTx(over: { mint?: string; authority?: string; amount?: string; after?: string; account?: string } = {}) {
    const amount = over.amount ?? "8000000";
    return parsedTx({
      payer,
      keys: [{ pubkey: payer, signer: true }, { pubkey: payerAta }, { pubkey: mint }, { pubkey: reference }],
      instructions: [
        {
          program: "spl-token",
          type: "burnChecked",
          info: { account: over.account ?? payerAta, mint: over.mint ?? mint, authority: over.authority ?? payer, tokenAmount: { amount, decimals: 6 } },
        },
      ],
      preTokenBalances: [{ accountIndex: 1, mint, uiTokenAmount: { amount: "50000000", decimals: 6, uiAmount: 50, uiAmountString: "50" } }] as never,
      postTokenBalances: [{ accountIndex: 1, mint, uiTokenAmount: { amount: over.after ?? String(50_000_000 - Number(amount)), decimals: 6, uiAmount: 42, uiAmountString: "42" } }] as never,
    });
  }
  const exp = (): PaymentExpectation => ({ kind: "BURN", payer, destination: payerAta, mint, minAmount: 8_000_000n, reference, ...window });

  it("accepts a burn from the payer's own token account", () => {
    expect(validatePaymentTransaction(burnTx(), exp())).toMatchObject({ ok: true, amount: 8_000_000n });
  });
  it("rejects burning a different token", () => {
    expect(validatePaymentTransaction(burnTx({ mint: key() }), exp())).toMatchObject({ ok: false, reason: /burn/ });
  });
  it("rejects a burn signed by someone else or from another account", () => {
    expect(validatePaymentTransaction(burnTx({ authority: key() }), exp()).ok).toBe(false);
    expect(validatePaymentTransaction(burnTx({ account: key() }), exp()).ok).toBe(false);
  });
  it("rejects burning less than quoted", () => {
    expect(validatePaymentTransaction(burnTx({ amount: "7999999" }), exp())).toMatchObject({ ok: false, reason: /lower/ });
  });
  it("rejects when the balance didn't actually drop", () => {
    expect(validatePaymentTransaction(burnTx({ after: "50000000" }), exp())).toMatchObject({ ok: false, reason: /decrease/ });
  });
  it("does not accept a transfer as a burn", () => {
    const transfer = parsedTx({
      payer,
      keys: [{ pubkey: payer, signer: true }, { pubkey: payerAta }, { pubkey: reference }],
      instructions: [{ program: "spl-token", type: "transferChecked", info: { source: payerAta, destination: payerAta, mint, authority: payer, tokenAmount: { amount: "8000000", decimals: 6 } } }],
    });
    expect(validatePaymentTransaction(transfer, exp()).ok).toBe(false);
  });
});
