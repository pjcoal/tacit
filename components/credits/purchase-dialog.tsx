"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AlertTriangle, CheckCircle2, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { useAccount } from "@/components/app/account-provider";
import { useConfig } from "@/components/providers/config-provider";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { useWalletModal } from "@/components/wallet/wallet-provider";
import { formatBaseUnits, type PaymentCurrency } from "@/lib/credits/calc";
import { shortAddress } from "@/lib/solana/address";
import { assertTransactionShape, confirmSignature, decodeTransaction, PROGRAMS } from "@/lib/solana/client";
import { explorerTxUrl } from "@/lib/solana/links";
import { apiJson, formatUsd } from "@/lib/utils";

export interface Product {
  kind: "credits" | "plan";
  productId: string;
  label: string;
  currency: PaymentCurrency;
}

interface Intent {
  id: string;
  currency: PaymentCurrency;
  amountBaseUnits: string;
  decimals: number;
  usd: number;
  unitPriceUsd: number;
  credits: number;
  destination: string;
  expiresAt: string;
}

type Phase = "idle" | "quoting" | "quoted" | "signing" | "confirming" | "verifying" | "done" | "error";

export function PurchaseDialog({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const cfg = useConfig();
  const { refresh } = useAccount();
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const walletModal = useWalletModal();
  const [phase, setPhase] = useState<Phase>("idle");
  const [intent, setIntent] = useState<Intent | null>(null);
  const [tx, setTx] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [result, setResult] = useState<{ credits: number; balance: number } | null>(null);

  useEffect(() => {
    if (phase !== "quoted") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [phase]);

  const burning = product?.currency === "BURN";
  const symbol = product?.currency === "TOKEN" || burning ? `$${cfg.token.symbol}` : product?.currency;
  const secondsLeft = intent ? Math.max(0, Math.floor((new Date(intent.expiresAt).getTime() - now) / 1000)) : 0;

  async function quote() {
    if (!product || !publicKey) return;
    setError(null);
    setPhase("quoting");
    try {
      const r = await apiJson<{ intent: Intent; transaction: string }>("/api/payments/intents", {
        method: "POST",
        json: { kind: product.kind, productId: product.productId, currency: product.currency, payer: publicKey.toBase58() },
      });
      setIntent(r.intent);
      setTx(r.transaction);
      setNow(Date.now());
      setPhase("quoted");
    } catch (e) {
      setError((e as Error).message);
      setPhase("error");
    }
  }

  async function pay() {
    if (!intent || !tx || !publicKey) return;
    setError(null);
    setPhase("signing");
    try {
      const transaction = decodeTransaction(tx);
      assertTransactionShape(transaction, { feePayer: publicKey, allowed: PROGRAMS.payment });
      const sig = await sendTransaction(transaction, connection);
      setSignature(sig);
      setPhase("confirming");
      await confirmSignature(connection, sig, "confirmed");
      setPhase("verifying");
      // The server re-fetches the transaction from the chain and checks it before issuing credits.
      const deadline = Date.now() + 3 * 60_000;
      for (;;) {
        const res = await fetch("/api/payments/verify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ intentId: intent.id, signature: sig }),
        });
        const body = await res.json().catch(() => ({}));
        if (res.status === 202) {
          if (Date.now() > deadline) throw new Error("Still waiting for finality. Your payment is safe — reopen this page later to retry verification.");
          await new Promise((r) => setTimeout(r, 3000));
          continue;
        }
        if (!res.ok) throw new Error(body.error ?? "Verification failed");
        setResult({ credits: body.credits, balance: body.balance });
        setPhase("done");
        refresh();
        break;
      }
    } catch (e) {
      const msg = (e as Error).message ?? "Payment failed";
      setError(/reject|cancel|declin/i.test(msg) ? "You declined in your wallet. Nothing was sent." : msg);
      setPhase("error");
    }
  }

  return (
    <Dialog open={Boolean(product)} onOpenChange={(v) => !v && onClose()} title={product?.label ?? ""} description="One transfer from your wallet. Credits are issued after our server verifies it on Solana.">
      <div data-testid="purchase-dialog">
        {phase === "done" && result ? (
          <div className="py-4 text-center">
            <CheckCircle2 size={40} className="mx-auto text-mint" />
            <h3 className="mt-4 text-[18px] font-semibold">+{result.credits.toLocaleString("en-US")} credits</h3>
            <p className="mt-1 text-[14px] text-ink-2">New balance: {result.balance.toLocaleString("en-US")} credits</p>
            {signature ? (
              <a href={explorerTxUrl(signature, cfg.network)} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium hover:underline">
                View payment <ExternalLink size={12} />
              </a>
            ) : null}
            <Button className="mt-6 w-full" onClick={onClose}>
              Done
            </Button>
          </div>
        ) : (
          <>
            {intent ? (
              <dl className="space-y-2 rounded-xl border border-line p-4 text-[14px]">
                <div className="flex justify-between">
                  <dt className="text-dim">{burning ? "You burn" : "You pay"}</dt>
                  <dd className="font-medium tabular-nums">
                    {formatBaseUnits(BigInt(intent.amountBaseUnits), intent.decimals, 6)} {symbol}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-dim">Value</dt>
                  <dd className="tabular-nums">{formatUsd(intent.usd)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-dim">You receive</dt>
                  <dd className="tabular-nums">{intent.credits.toLocaleString("en-US")} credits</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-dim">{burning ? "Burned from" : "To (treasury)"}</dt>
                  <dd className="font-mono text-[12.5px]">{shortAddress(intent.destination, 6)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-dim">Quote valid</dt>
                  <dd className={secondsLeft < 30 ? "text-danger" : ""}>{phase === "quoted" ? `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}` : "—"}</dd>
                </div>
              </dl>
            ) : null}
            {burning ? (
              <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-soft px-3 py-2 text-[12.5px] text-ink-2">
                <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber" />
                These tokens are destroyed permanently by an on-chain burn from your own wallet. Nobody receives them and it can&apos;t be undone.
              </p>
            ) : null}
            {intent ? null : (
              <p className="rounded-xl border border-line bg-sunken px-4 py-3 text-[13.5px] text-ink-2">
                We&apos;ll quote the exact {symbol} amount at the current price. The quote is valid for a few minutes.
              </p>
            )}

            {error ? (
              <p className="mt-3 flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger" role="alert">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {error}
              </p>
            ) : null}

            <div className="mt-5 space-y-2">
              {!publicKey ? (
                <Button size="lg" className="w-full" onClick={walletModal.open}>
                  Connect wallet
                </Button>
              ) : phase === "idle" || phase === "error" || (phase === "quoted" && secondsLeft === 0) ? (
                <Button size="lg" className="w-full" onClick={quote}>
                  {phase === "idle" ? "Get quote" : "Get a new quote"}
                </Button>
              ) : phase === "quoted" ? (
                <Button size="lg" className="w-full" onClick={pay} data-testid="approve-payment">
                  Approve in wallet
                </Button>
              ) : (
                <Button size="lg" className="w-full" disabled>
                  <Spinner />
                  {phase === "quoting" ? "Preparing quote…" : phase === "signing" ? "Waiting for your wallet…" : phase === "confirming" ? "Confirming on Solana…" : "Verifying payment…"}
                </Button>
              )}
              {publicKey ? <p className="text-center font-mono text-[11.5px] text-dim">Paying from {shortAddress(publicKey.toBase58(), 5)}</p> : null}
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
