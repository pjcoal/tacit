"use client";

import { Check, Coins } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAccount } from "@/components/app/account-provider";
import { PageHeader } from "@/components/app/page-header";
import { useConfig } from "@/components/providers/config-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { creditsForPackage, packageChargeUsd, planPriceUsd, type PaymentCurrency } from "@/lib/credits/calc";
import { currencyOptions, effectiveCurrency } from "./currency-options";
import { apiJson, cn, formatUsd } from "@/lib/utils";
import { AccountGate } from "./account-panel";
import { PurchaseDialog, type Product } from "./purchase-dialog";
import { TokenGate } from "./token-gate";

interface LedgerRow {
  createdAt: string;
  delta: number;
  reason: string;
}

export function CreditsPage() {
  const cfg = useConfig();
  const params = useSearchParams();
  const { account, loading } = useAccount();
  const [chosenCurrency, setCurrency] = useState<PaymentCurrency>(() => {
    const c = params.get("currency");
    return c === "SOL" || c === "USDC" ? c : c === "BURN" || c === "TOKEN" ? "BURN" : "USDC";
  });
  const [usd, setUsd] = useState<number>(() => Number(params.get("package")) || cfg.payments.packagesUsd[1] || cfg.payments.packagesUsd[0]);
  const [product, setProduct] = useState<Product | null>(null);
  const [ledger, setLedger] = useState<LedgerRow[] | null>(null);

  const currency: PaymentCurrency = effectiveCurrency(cfg, chosenCurrency);
  const burnBps = cfg.payments.burnDiscountBps;

  useEffect(() => {
    if (!account) return;
    apiJson<{ ledger: LedgerRow[] }>("/api/account/usage").then((r) => setLedger(r.ledger)).catch(() => setLedger([]));
  }, [account]);

  // Arriving from a "Get Pro" link opens that plan's checkout once an account exists.
  const planParam = params.get("plan");
  const [autoDismissed, setAutoDismissed] = useState(false);
  const linkedPlan = cfg.plans.find((p) => p.id === planParam && p.id !== "free");
  const autoProduct: Product | null =
    !autoDismissed && account && linkedPlan && cfg.payments.enabled
      ? { kind: "plan", productId: linkedPlan.id, label: `${linkedPlan.name} · ${linkedPlan.durationDays} days`, currency }
      : null;
  const activeProduct = product ?? autoProduct;

  const pkg = creditsForPackage({ usd, currency, creditsPerUsd: cfg.payments.creditsPerUsd, tokenBonusBps: cfg.payments.tokenBonusBps });
  const charge = packageChargeUsd(usd, currency, burnBps);

  return (
    <div className="scrollbar-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-[920px] px-5 py-8 sm:py-12">
        <PageHeader icon={Coins} title="Credits" description="Pay once with a Solana wallet. Credits are issued only after our server verifies the transaction on-chain." />

        {!cfg.payments.enabled ? (
          <p className="mb-6 rounded-xl border border-amber/30 bg-amber-soft px-4 py-3 text-[13.5px]" role="status">
            Wallet payments are opening soon. Free chat works in the meantime — no account needed.
          </p>
        ) : null}

        {loading ? (
          <div className="shimmer h-40 rounded-2xl" />
        ) : !account ? (
          <AccountGate reason="Credits need somewhere to live." />
        ) : (
          <div className="card grid gap-6 p-6 sm:grid-cols-3" data-testid="balance-card">
            <div>
              <div className="eyebrow">Balance</div>
              <div className="display mt-2 text-[48px] tabular-nums">{account.balance.toLocaleString("en-US")}</div>
              <div className="text-[13px] text-dim">credits · ≈ {formatUsd(account.balance / cfg.payments.creditsPerUsd)}</div>
            </div>
            <div>
              <div className="eyebrow">Plan</div>
              <div className="mt-3 text-[17px] font-medium">{account.plan ? cfg.plans.find((p) => p.id === account.plan!.id)?.name : "Free"}</div>
              <div className="text-[13px] text-dim">{account.plan ? `until ${new Date(account.plan.endsAt).toLocaleDateString()}` : "No expiry"}</div>
            </div>
            <div>
              <div className="eyebrow">Account</div>
              <div className="mt-3 text-[14px]">Pseudonymous</div>
              <div className="text-[13px] text-dim">since {new Date(account.createdAt).toLocaleDateString()}</div>
            </div>
          </div>
        )}

        <section className="mt-10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-[18px] font-semibold">Buy credits</h2>
            <Segmented ariaLabel="Currency" value={currency} onChange={setCurrency} options={currencyOptions(cfg)} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {cfg.payments.packagesUsd.map((p) => {
              const c = creditsForPackage({ usd: p, currency, creditsPerUsd: cfg.payments.creditsPerUsd, tokenBonusBps: cfg.payments.tokenBonusBps });
              return (
                <button
                  key={p}
                  onClick={() => setUsd(p)}
                  className={cn("card px-4 py-4 text-left transition-colors", usd === p ? "border-ink shadow-[0_0_0_1px_var(--ink)]" : "hover:border-ink/30")}
                >
                  <div className="text-[20px] font-semibold">
                    {currency === "BURN" ? (
                      <>
                        {formatUsd(packageChargeUsd(p, currency, burnBps))} <span className="text-[13px] font-normal text-dim line-through">${p}</span>
                      </>
                    ) : (
                      `$${p}`
                    )}
                  </div>
                  <div className="text-[13px] text-ink-2 tabular-nums">{c.total.toLocaleString("en-US")} credits</div>
                  {c.bonus ? <div className="mt-1 text-[11.5px] text-mint">+{c.bonus.toLocaleString("en-US")} bonus</div> : null}
                </button>
              );
            })}
          </div>
          <Button
            size="lg"
            className="mt-4 w-full sm:w-auto"
            disabled={!account || !cfg.payments.enabled}
            onClick={() => setProduct({ kind: "credits", productId: `credits_${usd}`, label: `${pkg.total.toLocaleString("en-US")} credits`, currency })}
            data-testid="buy-credits"
          >
            {currency === "BURN"
              ? `Burn ${formatUsd(charge)} of $${cfg.token.symbol} for ${pkg.total.toLocaleString("en-US")} credits`
              : `Buy ${pkg.total.toLocaleString("en-US")} credits for $${usd}`}
          </Button>
          {currency === "BURN" ? (
            <p className="mt-3 max-w-xl text-[13px] text-ink-2">
              Burning is {burnBps / 100}% cheaper than paying in USDC. The tokens are destroyed permanently with an on-chain burn from your own wallet — nobody receives them, and it can&apos;t be undone.
            </p>
          ) : null}
        </section>

        <section className="mt-12">
          <h2 className="text-[18px] font-semibold">Plans</h2>
          <p className="mt-1 text-[13.5px] text-ink-2">Fixed-duration access paid in one transaction. Nothing renews or charges automatically.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {cfg.plans
              .filter((p) => p.id !== "free")
              .map((p) => {
                const price = planPriceUsd(p.priceUsd, currency, cfg.payments.tokenPlanDiscountBps, burnBps);
                return (
                  <div key={p.id} className="card flex flex-col p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-[16px] font-semibold">{p.name}</span>
                      {account?.plan?.id === p.id ? <Badge tone="mint">Active</Badge> : null}
                    </div>
                    <div className="mt-2 text-[24px] font-semibold tabular-nums">
                      {formatUsd(price)} <span className="text-[13px] font-normal text-dim">/ {p.durationDays} days</span>
                    </div>
                    <ul className="mt-3 flex-1 space-y-1.5">
                      {p.perks.map((perk) => (
                        <li key={perk} className="flex gap-2 text-[13px] text-ink-2">
                          <Check size={14} className="mt-0.5 shrink-0" /> {perk}
                        </li>
                      ))}
                    </ul>
                    <Button
                      variant="secondary"
                      className="mt-4"
                      disabled={!account || !cfg.payments.enabled}
                      onClick={() => setProduct({ kind: "plan", productId: p.id, label: `${p.name} · ${p.durationDays} days`, currency })}
                    >
                      {account?.plan?.id === p.id ? "Extend" : "Get"} {p.name}
                    </Button>
                  </div>
                );
              })}
          </div>
        </section>

        <section className="mt-12 grid gap-4 md:grid-cols-2">
          <TokenGate />
          <div className="card p-6">
            <h3 className="text-[15px] font-semibold">History</h3>
            {!account ? (
              <p className="mt-2 text-[13.5px] text-dim">No account yet.</p>
            ) : ledger === null ? (
              <div className="shimmer mt-3 h-16 rounded" />
            ) : ledger.length === 0 ? (
              <p className="mt-2 text-[13.5px] text-dim">No purchases yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-line-2 text-[13px]">
                {ledger.map((l, i) => (
                  <li key={i} className="flex justify-between py-2">
                    <span className="capitalize text-ink-2">{l.reason.replace("_", " ")}</span>
                    <span className="tabular-nums">
                      {l.delta > 0 ? "+" : ""}
                      {l.delta.toLocaleString("en-US")} <span className="text-dim">· {new Date(l.createdAt).toLocaleDateString()}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
      <PurchaseDialog
        key={activeProduct ? `${activeProduct.productId}:${activeProduct.currency}` : "none"}
        product={activeProduct}
        onClose={() => {
          setProduct(null);
          setAutoDismissed(true);
        }}
      />
    </div>
  );
}
