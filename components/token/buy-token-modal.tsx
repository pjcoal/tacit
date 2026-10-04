"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AlertTriangle, ArrowDown, CheckCircle2, ExternalLink } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useConfig } from "@/components/providers/config-provider";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Segmented } from "@/components/ui/segmented";
import { Spinner } from "@/components/ui/spinner";
import { SolanaProviders, useWalletModal } from "@/components/wallet/wallet-provider";
import { WalletButton } from "@/components/wallet/wallet-button";
import { useBalances } from "@/components/wallet/use-balances";
import { formatBaseUnits } from "@/lib/credits/calc";
import { assertTransactionShape, confirmSignature, decodeTransaction, PROGRAMS, solToLamports } from "@/lib/solana/client";
import { explorerTxUrl } from "@/lib/solana/links";
import { apiJson, cn, formatNumber } from "@/lib/utils";

interface Quote {
  venue: "bonding_curve" | "pumpswap";
  amountIn: string;
  expectedOut: string;
  minOut: string;
  priceImpactPct: number;
  feeBps: number | null;
  slippagePct: number;
  accountRentLamports: number;
  networkFeeLamports: number;
}

type Phase = "input" | "review" | "signing" | "confirming" | "success" | "error";

export function BuyTokenModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const cfg = useConfig();
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const walletModal = useWalletModal();
  const { sol } = useBalances();

  const [amount, setAmount] = useState("0.1");
  const [slippage, setSlippage] = useState("2");
  const [rawQuote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [phase, setPhase] = useState<Phase>("input");
  const [error, setError] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [programs, setPrograms] = useState<string[]>([]);

  const lamports = useMemo(() => {
    const n = Number(amount);
    return Number.isFinite(n) && n >= 0.001 && n <= 1000 ? solToLamports(n) : null;
  }, [amount]);

  // Debounced live quote.
  useEffect(() => {
    if (!open || phase !== "input" || !lamports) return;
    const t = setTimeout(() => {
      setQuoting(true);
      apiJson<{ quote: Quote }>("/api/token/quote", {
        method: "POST",
        json: { lamports: lamports.toString(), slippagePct: Number(slippage), user: publicKey?.toBase58() },
      })
        .then((r) => {
          setQuote(r.quote);
          setError(null);
        })
        .catch((e) => {
          setQuote(null);
          setError(e.message);
        })
        .finally(() => setQuoting(false));
    }, 350);
    return () => clearTimeout(t);
  }, [open, lamports, slippage, publicKey, phase]);

  const reset = () => {
    setPhase("input");
    setError(null);
    setSignature(null);
  };

  async function approve() {
    if (!publicKey || !lamports) return;
    setError(null);
    setPhase("signing");
    try {
      const built = await apiJson<{ transaction: string; quote: Quote }>("/api/token/buy-tx", {
        method: "POST",
        json: { user: publicKey.toBase58(), lamports: lamports.toString(), slippagePct: Number(slippage) },
      });
      const tx = decodeTransaction(built.transaction);
      setPrograms(assertTransactionShape(tx, { feePayer: publicKey, allowed: PROGRAMS.pumpTrade }));
      setQuote(built.quote);
      // The wallet shows its own simulation; nothing is signed without the user approving there.
      const sig = await sendTransaction(tx, connection, { skipPreflight: false, preflightCommitment: "confirmed" });
      setSignature(sig);
      setPhase("confirming");
      await confirmSignature(connection, sig, "confirmed");
      setPhase("success");
      fetch("/api/token/purchases", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ signature: sig, venue: built.quote.venue }) }).catch(() => {});
    } catch (e) {
      const msg = (e as Error).message ?? "Something went wrong";
      setError(/reject|cancel|declin/i.test(msg) ? "You declined the transaction in your wallet. Nothing was sent." : msg);
      setPhase("error");
    }
  }

  const decimals = cfg.token.decimals;
  // A quote is only meaningful for a valid amount.
  const quote = lamports ? rawQuote : null;
  const out = quote ? formatBaseUnits(BigInt(quote.expectedOut), decimals, 2) : "—";
  const minOut = quote ? formatBaseUnits(BigInt(quote.minOut), decimals, 2) : "—";
  const insufficient = sol != null && lamports != null && Number(lamports) / 1e9 + 0.003 > sol;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }} title={`Buy $${cfg.token.symbol}`} description={`Swap SOL for $${cfg.token.symbol} on ${quote?.venue === "pumpswap" ? "PumpSwap" : "the Pump bonding curve"}. You approve every transaction in your wallet.`}>
      <div data-testid="buy-token-modal">
        {phase === "success" && signature ? (
          <div className="py-4 text-center">
            <CheckCircle2 size={40} className="mx-auto text-mint" />
            <h3 className="mt-4 text-[18px] font-semibold">Purchase confirmed</h3>
            <p className="mt-1 text-[14px] text-ink-2">
              About {out} ${cfg.token.symbol} (at least {minOut}) is on its way to your wallet.
            </p>
            <a href={explorerTxUrl(signature, cfg.network)} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1 text-[13.5px] font-medium hover:underline">
              View transaction <ExternalLink size={13} />
            </a>
            <Button className="mt-6 w-full" variant="secondary" onClick={() => { reset(); onOpenChange(false); }}>
              Done
            </Button>
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-line bg-sunken p-4">
              <div className="flex items-center justify-between text-[12.5px] text-dim">
                <span>You pay</span>
                {sol != null ? (
                  <button className="hover:text-ink" onClick={() => setAmount(Math.max(0, sol - 0.01).toFixed(3))}>
                    Balance {formatNumber(sol, 4)} SOL
                  </button>
                ) : null}
              </div>
              <div className="mt-1 flex items-center gap-3">
                <input
                  inputMode="decimal"
                  aria-label="SOL amount"
                  value={amount}
                  disabled={phase !== "input"}
                  onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                  className="min-w-0 flex-1 bg-transparent text-[28px] font-medium tabular-nums outline-none"
                />
                <span className="rounded-full border border-line bg-surface px-3 py-1 text-[13px] font-medium">SOL</span>
              </div>
            </div>
            <div className="relative z-10 -my-2.5 flex justify-center">
              <span className="grid h-8 w-8 place-items-center rounded-full border border-line bg-surface">
                <ArrowDown size={14} />
              </span>
            </div>
            <div className="rounded-xl border border-line p-4">
              <div className="text-[12.5px] text-dim">You receive (estimated)</div>
              <div className="mt-1 flex items-center gap-3">
                <span className={cn("min-w-0 flex-1 truncate text-[28px] font-medium tabular-nums", quoting && "opacity-50")}>{out}</span>
                <span className="rounded-full border border-line bg-surface px-3 py-1 text-[13px] font-medium">${cfg.token.symbol}</span>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <span className="text-[13px] text-ink-2">Max slippage</span>
              <Segmented ariaLabel="Slippage" size="sm" value={slippage} onChange={setSlippage} options={["1", "2", "5", "10"].map((v) => ({ value: v, label: `${v}%` }))} />
            </div>

            <dl className="mt-4 space-y-1.5 rounded-xl border border-line-2 px-4 py-3 text-[13px]">
              {[
                ["Venue", quote ? (quote.venue === "pumpswap" ? "PumpSwap (graduated)" : "Pump bonding curve") : "—"],
                ["Minimum received", quote ? `${minOut} $${cfg.token.symbol}` : "—"],
                ["Price impact", quote ? `${quote.priceImpactPct.toFixed(2)}%` : "—"],
                ["Pump / PumpSwap fees", quote?.feeBps != null ? `${(quote.feeBps / 100).toFixed(2)}%` : quote ? "Included in quote" : "—"],
                ["Network fee", quote ? `≈ ${(quote.networkFeeLamports / 1e9).toFixed(6)} SOL` : "—"],
                ...(quote?.accountRentLamports ? [["Token account rent (one-time)", `${(quote.accountRentLamports / 1e9).toFixed(5)} SOL`]] : []),
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="text-dim">{k}</dt>
                  <dd className={cn("text-right tabular-nums", k === "Price impact" && quote && quote.priceImpactPct > 5 && "text-danger")}>{v}</dd>
                </div>
              ))}
            </dl>

            {programs.length ? <p className="mt-2 font-mono text-[11px] text-dim">Programs: {[...new Set(programs)].join(" · ")}</p> : null}
            {error ? (
              <p className="mt-3 flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {error}
              </p>
            ) : null}

            <div className="mt-5 space-y-2">
              {!publicKey ? (
                <Button size="lg" className="w-full" onClick={walletModal.open}>
                  Connect wallet
                </Button>
              ) : phase === "input" || phase === "error" ? (
                <>
                  {phase === "input" && quote ? (
                    <Button size="lg" className="w-full" disabled={!quote || quoting || insufficient} onClick={() => setPhase("review")}>
                      {insufficient ? "Insufficient SOL" : "Review purchase"}
                    </Button>
                  ) : phase === "error" ? (
                    <Button size="lg" className="w-full" variant="secondary" onClick={reset}>
                      Start over
                    </Button>
                  ) : (
                    <Button size="lg" className="w-full" disabled>
                      {quoting ? "Fetching quote…" : "Enter an amount"}
                    </Button>
                  )}
                </>
              ) : phase === "review" ? (
                <>
                  <p className="rounded-lg bg-amber-soft px-3 py-2 text-[12.5px] text-ink-2">
                    You&apos;re about to spend {amount} SOL. Tokens on a bonding curve are highly volatile and can lose all value. This isn&apos;t financial advice.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button size="lg" variant="secondary" onClick={() => setPhase("input")}>
                      Back
                    </Button>
                    <Button size="lg" onClick={approve}>
                      Approve in wallet
                    </Button>
                  </div>
                </>
              ) : (
                <Button size="lg" className="w-full" disabled>
                  <Spinner /> {phase === "signing" ? "Waiting for your wallet…" : "Confirming on Solana…"}
                </Button>
              )}
              {publicKey ? <WalletButton /> : null}
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}

/** For pages without wallet providers (the landing page): mounts them on demand. */
export function BuyTokenModalStandalone(props: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <SolanaProviders>
      <BuyTokenModal {...props} />
    </SolanaProviders>
  );
}
