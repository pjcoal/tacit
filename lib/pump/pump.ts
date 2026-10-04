import "server-only";
import {
  bondingCurveMarketCap,
  bondingCurvePda,
  computeFeesBps,
  getBuyTokenAmountFromSolAmount,
  getSellSolAmountFromTokenAmount,
  isLegacyQuoteMint,
  OnlinePumpSdk,
  PUMP_SDK,
} from "@pump-fun/pump-sdk";
import { buyQuoteInput, canonicalPumpPoolPda, OnlinePumpAmmSdk, PUMP_AMM_SDK, sellBaseInput } from "@pump-fun/pump-swap-sdk";
import { ComputeBudgetProgram, PublicKey, Transaction, type TransactionInstruction } from "@solana/web3.js";
import BN from "bn.js";
import { getVerifiedConnection } from "@/lib/solana/connection";
import { readMintInfo, type MintInfo } from "@/lib/solana/token-metadata";

/**
 * Pump.fun integration using the official @pump-fun/pump-sdk (bonding curve)
 * and @pump-fun/pump-swap-sdk (PumpSwap AMM after graduation).
 *
 * Every transaction built here is returned *unsigned*. The user's (or the
 * treasury's) wallet signs it; this server never holds keys.
 */

const toBig = (bn: BN) => BigInt(bn.toString());
const LAMPORTS = 1_000_000_000;

export interface BondingCurveState {
  address: string;
  complete: boolean;
  quoteMint: string;
  solQuoted: boolean;
  virtualTokenReserves: string;
  virtualQuoteReserves: string;
  realTokenReserves: string;
  realQuoteReserves: string;
  tokenTotalSupply: string;
  creator: string;
  /** Quote (lamports for SOL) per whole token. */
  priceQuotePerToken: number;
  /** Market cap in quote base units (lamports for SOL). */
  marketCapQuote: string;
  /** 0–100, share of curve tokens sold. */
  progressPct: number;
}

export interface PumpSwapPoolState {
  address: string;
  quoteMint: string;
  baseReserve: string;
  quoteReserve: string;
  priceQuotePerToken: number;
  coinCreator: string;
}

export type GraduationStatus =
  | { status: "not_found" }
  | { status: "bonding_curve"; progressPct: number }
  | { status: "graduated"; pool: string | null };

async function sdk() {
  const conn = await getVerifiedConnection();
  return { conn, pump: new OnlinePumpSdk(conn), amm: new OnlinePumpAmmSdk(conn) };
}

export async function getPumpCoin(mint: string): Promise<MintInfo> {
  const { conn } = await sdk();
  return readMintInfo(conn, new PublicKey(mint));
}

export async function getBondingCurveState(mint: string): Promise<BondingCurveState | null> {
  const { conn, pump } = await sdk();
  const mintKey = new PublicKey(mint);
  const address = bondingCurvePda(mintKey);
  const info = await conn.getAccountInfo(address);
  if (!info) return null;
  const curve = PUMP_SDK.decodeBondingCurve(info);
  const [global, supply] = await Promise.all([pump.fetchGlobal(), conn.getTokenSupply(mintKey)]);
  const decimals = supply.value.decimals;
  const vT = Number(curve.virtualTokenReserves.toString());
  const vQ = Number(curve.virtualQuoteReserves.toString());
  const initialReal = Number(global.initialRealTokenReserves.toString());
  const real = Number(curve.realTokenReserves.toString());
  return {
    address: address.toBase58(),
    complete: curve.complete,
    quoteMint: curve.quoteMint.toBase58(),
    solQuoted: isLegacyQuoteMint(curve.quoteMint),
    virtualTokenReserves: curve.virtualTokenReserves.toString(),
    virtualQuoteReserves: curve.virtualQuoteReserves.toString(),
    realTokenReserves: curve.realTokenReserves.toString(),
    realQuoteReserves: curve.realQuoteReserves.toString(),
    tokenTotalSupply: curve.tokenTotalSupply.toString(),
    creator: curve.creator.toBase58(),
    priceQuotePerToken: vT > 0 ? (vQ / vT) * 10 ** decimals : 0,
    marketCapQuote: bondingCurveMarketCap({
      mintSupply: curve.tokenTotalSupply,
      virtualQuoteReserves: curve.virtualQuoteReserves,
      virtualTokenReserves: curve.virtualTokenReserves,
    }).toString(),
    progressPct: curve.complete ? 100 : initialReal > 0 ? Math.max(0, Math.min(100, (1 - real / initialReal) * 100)) : 0,
  };
}

export async function getPumpSwapPool(mint: string): Promise<PumpSwapPoolState | null> {
  const { conn, amm } = await sdk();
  const poolKey = canonicalPumpPoolPda(new PublicKey(mint));
  const info = await conn.getAccountInfo(poolKey);
  if (!info) return null;
  // swapSolanaState reads reserves and mint data; the user is irrelevant for a read-only quote.
  const state = await amm.swapSolanaState(poolKey, PublicKey.default);
  const base = Number(state.poolBaseAmount.toString());
  const quote = Number(state.poolQuoteAmount.toString());
  const decimals = state.baseMintAccount.decimals;
  return {
    address: poolKey.toBase58(),
    quoteMint: state.pool.quoteMint.toBase58(),
    baseReserve: state.poolBaseAmount.toString(),
    quoteReserve: state.poolQuoteAmount.toString(),
    priceQuotePerToken: base > 0 ? (quote / base) * 10 ** decimals : 0,
    coinCreator: state.pool.coinCreator.toBase58(),
  };
}

export async function getGraduationStatus(mint: string): Promise<GraduationStatus> {
  const curve = await getBondingCurveState(mint);
  if (!curve) {
    const pool = await getPumpSwapPool(mint).catch(() => null);
    return pool ? { status: "graduated", pool: pool.address } : { status: "not_found" };
  }
  if (!curve.complete) return { status: "bonding_curve", progressPct: curve.progressPct };
  const pool = await getPumpSwapPool(mint).catch(() => null);
  return { status: "graduated", pool: pool?.address ?? null };
}

export interface TokenQuote {
  venue: "bonding_curve" | "pumpswap";
  side: "buy" | "sell";
  /** Input amount in base units (lamports for buys, token base units for sells). */
  amountIn: string;
  /** Expected output in base units. */
  expectedOut: string;
  /** Worst-case output after slippage. */
  minOut: string;
  priceImpactPct: number;
  /** Protocol + creator (+ LP) fees in basis points, where the SDK exposes them. */
  feeBps: number | null;
  slippagePct: number;
  /** One-time rent if the user's token account must be created (lamports). */
  accountRentLamports: number;
  networkFeeLamports: number;
}

const ATA_RENT_LAMPORTS = 2_039_280;
const BASE_FEE_LAMPORTS = 5_000;

/** Quote a SOL→token buy (or token→SOL sell) on whichever venue the coin currently trades. */
export async function getTokenQuote(params: {
  mint: string;
  side: "buy" | "sell";
  amountIn: bigint;
  slippagePct: number;
  user?: string;
}): Promise<TokenQuote> {
  const { conn, pump, amm } = await sdk();
  const mint = new PublicKey(params.mint);
  const user = params.user ? new PublicKey(params.user) : PublicKey.default;
  const amount = new BN(params.amountIn.toString());
  const curveInfo = await conn.getAccountInfo(bondingCurvePda(mint));

  if (curveInfo) {
    const curve = PUMP_SDK.decodeBondingCurve(curveInfo);
    if (!curve.complete) {
      if (!isLegacyQuoteMint(curve.quoteMint)) throw new Error("This coin's bonding curve is not quoted in SOL; it can't be traded here.");
      const [global, feeConfig, mintInfo] = await Promise.all([pump.fetchGlobal(), pump.fetchFeeConfig(), conn.getTokenSupply(mint)]);
      const mintSupply = new BN(mintInfo.value.amount);
      const fees = computeFeesBps({
        global,
        feeConfig,
        mintSupply,
        virtualQuoteReserves: curve.virtualQuoteReserves,
        virtualTokenReserves: curve.virtualTokenReserves,
        quoteMint: curve.quoteMint,
        creatorFeeBps: curve.creatorFeeBps,
      });
      const feeBps = Number(fees.protocolFeeBps.add(fees.creatorFeeBps).toString());
      const spot = Number(curve.virtualQuoteReserves.toString()) / Number(curve.virtualTokenReserves.toString());

      if (params.side === "buy") {
        const out = getBuyTokenAmountFromSolAmount({ global, feeConfig, mintSupply, bondingCurve: curve, amount, quoteMint: curve.quoteMint });
        const outN = Number(out.toString());
        // Impact is measured on the amount that reaches the curve; fees are reported separately.
        const netIn = Number(params.amountIn) / (1 + feeBps / 10_000);
        const effective = outN > 0 ? netIn / outN : Infinity;
        const ata = params.user ? await conn.getAccountInfo(await userAta(mint, user, conn)) : null;
        return {
          venue: "bonding_curve",
          side: "buy",
          amountIn: params.amountIn.toString(),
          expectedOut: out.toString(),
          minOut: ((toBig(out) * BigInt(Math.round((100 - params.slippagePct) * 100))) / 10_000n).toString(),
          priceImpactPct: spot > 0 ? Math.max(0, (effective / spot - 1) * 100) : 0,
          feeBps,
          slippagePct: params.slippagePct,
          accountRentLamports: params.user && !ata ? ATA_RENT_LAMPORTS : 0,
          networkFeeLamports: BASE_FEE_LAMPORTS,
        };
      }
      const solOut = getSellSolAmountFromTokenAmount({ global, feeConfig, mintSupply, bondingCurve: curve, amount });
      const grossOut = Number(solOut.toString()) / (1 - feeBps / 10_000);
      const effective = grossOut / Number(params.amountIn);
      return {
        venue: "bonding_curve",
        side: "sell",
        amountIn: params.amountIn.toString(),
        expectedOut: solOut.toString(),
        minOut: ((toBig(solOut) * BigInt(Math.round((100 - params.slippagePct) * 100))) / 10_000n).toString(),
        priceImpactPct: spot > 0 ? Math.max(0, (1 - effective / spot) * 100) : 0,
        feeBps,
        slippagePct: params.slippagePct,
        accountRentLamports: 0,
        networkFeeLamports: BASE_FEE_LAMPORTS,
      };
    }
  }

  // Graduated (or never had a curve): trade on the canonical PumpSwap pool.
  const poolKey = canonicalPumpPoolPda(mint);
  if (!(await conn.getAccountInfo(poolKey))) throw new Error("No Pump bonding curve or PumpSwap pool exists for this mint.");
  const state = await amm.swapSolanaState(poolKey, user);
  const poolArgs = {
    baseReserve: state.poolBaseAmount,
    quoteReserve: state.poolQuoteAmount,
    virtualQuoteReserves: state.pool.virtualQuoteReserves,
    globalConfig: state.globalConfig,
    feeConfig: state.feeConfig,
    baseMint: state.baseMint,
    baseMintAccount: state.baseMintAccount,
    coinCreator: state.pool.coinCreator,
    creator: state.pool.creator,
    quoteMint: state.pool.quoteMint,
    isMayhemMode: state.pool.isMayhemMode,
    creatorFeeBps: state.pool.creatorFeeBps,
  };
  const spot = Number(state.poolQuoteAmount.toString()) / Number(state.poolBaseAmount.toString());
  if (params.side === "buy") {
    const r = buyQuoteInput({ ...poolArgs, quote: amount, slippage: params.slippagePct });
    const outN = Number(r.base.toString());
    const effective = outN > 0 ? Number(r.internalQuoteWithoutFees.toString()) / outN : Infinity;
    const feeBps = Number(params.amountIn) > 0
      ? Math.round((1 - Number(r.internalQuoteWithoutFees.toString()) / Number(params.amountIn)) * 10_000)
      : null;
    return {
      venue: "pumpswap",
      side: "buy",
      amountIn: params.amountIn.toString(),
      expectedOut: r.base.toString(),
      minOut: ((toBig(r.base) * BigInt(Math.round((100 - params.slippagePct) * 100))) / 10_000n).toString(),
      priceImpactPct: spot > 0 ? Math.max(0, (effective / spot - 1) * 100) : 0,
      feeBps,
      slippagePct: params.slippagePct,
      accountRentLamports: params.user && !state.userBaseAccountInfo ? ATA_RENT_LAMPORTS : 0,
      networkFeeLamports: BASE_FEE_LAMPORTS,
    };
  }
  const r = sellBaseInput({ ...poolArgs, base: amount, slippage: params.slippagePct });
  const effective = Number(r.uiQuote.toString()) / Number(params.amountIn);
  return {
    venue: "pumpswap",
    side: "sell",
    amountIn: params.amountIn.toString(),
    expectedOut: r.uiQuote.toString(),
    minOut: r.minQuote.toString(),
    priceImpactPct: spot > 0 ? Math.max(0, (1 - effective / spot) * 100) : 0,
    feeBps: null,
    slippagePct: params.slippagePct,
    accountRentLamports: 0,
    networkFeeLamports: BASE_FEE_LAMPORTS,
  };
}

async function userAta(mint: PublicKey, user: PublicKey, conn: Awaited<ReturnType<typeof getVerifiedConnection>>) {
  const { getAssociatedTokenAddressSync } = await import("@solana/spl-token");
  const info = await conn.getAccountInfo(mint);
  return getAssociatedTokenAddressSync(mint, user, true, info!.owner);
}

async function finalizeTransaction(instructions: TransactionInstruction[], feePayer: PublicKey, computeUnits: number) {
  const conn = await getVerifiedConnection();
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
  const tx = new Transaction({ feePayer, blockhash, lastValidBlockHeight });
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: computeUnits }), ...instructions);
  return {
    transaction: tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64"),
    lastValidBlockHeight,
  };
}

/** Build an unsigned buy transaction (SOL → token) for `user` to sign. */
export async function prepareBuyTransaction(params: { mint: string; user: string; lamports: bigint; slippagePct: number }) {
  const { conn, pump, amm } = await sdk();
  const mint = new PublicKey(params.mint);
  const user = new PublicKey(params.user);
  const amount = new BN(params.lamports.toString());
  const quote = await getTokenQuote({ mint: params.mint, side: "buy", amountIn: params.lamports, slippagePct: params.slippagePct, user: params.user });

  let instructions: TransactionInstruction[];
  if (quote.venue === "bonding_curve") {
    const mintAccount = await conn.getAccountInfo(mint);
    const tokenProgram = mintAccount!.owner;
    const [global, state] = await Promise.all([pump.fetchGlobal(), pump.fetchBuyState(mint, user, tokenProgram)]);
    instructions = await PUMP_SDK.buyInstructions({
      global,
      bondingCurveAccountInfo: state.bondingCurveAccountInfo,
      bondingCurve: state.bondingCurve,
      associatedUserAccountInfo: state.associatedUserAccountInfo,
      mint,
      user,
      solAmount: amount,
      amount: new BN(quote.expectedOut),
      slippage: params.slippagePct,
      tokenProgram,
    });
  } else {
    const state = await amm.swapSolanaState(canonicalPumpPoolPda(mint), user);
    instructions = await PUMP_AMM_SDK.buyQuoteInput(state, amount, params.slippagePct);
  }
  const built = await finalizeTransaction(instructions, user, 300_000);
  return { ...built, quote };
}

/** Build an unsigned sell transaction (token → SOL) for `user` to sign. */
export async function prepareSellTransaction(params: { mint: string; user: string; tokenAmount: bigint; slippagePct: number }) {
  const { conn, pump, amm } = await sdk();
  const mint = new PublicKey(params.mint);
  const user = new PublicKey(params.user);
  const amount = new BN(params.tokenAmount.toString());
  const quote = await getTokenQuote({ mint: params.mint, side: "sell", amountIn: params.tokenAmount, slippagePct: params.slippagePct, user: params.user });

  let instructions: TransactionInstruction[];
  if (quote.venue === "bonding_curve") {
    const mintAccount = await conn.getAccountInfo(mint);
    const tokenProgram = mintAccount!.owner;
    const [global, state] = await Promise.all([pump.fetchGlobal(), pump.fetchSellState(mint, user, tokenProgram)]);
    instructions = await PUMP_SDK.sellInstructions({
      global,
      bondingCurveAccountInfo: state.bondingCurveAccountInfo,
      bondingCurve: state.bondingCurve,
      mint,
      user,
      amount,
      solAmount: new BN(quote.expectedOut),
      slippage: params.slippagePct,
      tokenProgram,
      mayhemMode: state.bondingCurve.isMayhemMode,
      cashback: state.bondingCurve.isCashbackCoin,
    });
  } else {
    const state = await amm.swapSolanaState(canonicalPumpPoolPda(mint), user);
    instructions = await PUMP_AMM_SDK.sellBaseInput(state, amount, params.slippagePct);
  }
  const built = await finalizeTransaction(instructions, user, 300_000);
  return { ...built, quote };
}

export const lamportsToSol = (lamports: bigint | number) => Number(lamports) / LAMPORTS;
