"use client";

import { ArrowUpRight, Check, Copy, LineChart } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useConfig } from "@/components/providers/config-provider";
import { TokenFlow } from "@/components/token/token-flow";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCompactUsd, formatUsd } from "@/lib/utils";
import type { TokenInfo } from "@/server/services/token-info";

// Wallet libraries are only downloaded when someone actually opens the buy flow.
const BuyTokenModal = dynamic(() => import("@/components/token/buy-token-modal").then((m) => m.BuyTokenModalStandalone), { ssr: false });

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-line-2 py-3.5 sm:grid sm:grid-cols-[150px_1fr] sm:gap-4">
      <dt className="eyebrow pt-0.5">{label}</dt>
      <dd className="mt-1 text-[14px] sm:mt-0">{children}</dd>
    </div>
  );
}

export function TokenSection() {
  const cfg = useConfig();
  const [info, setInfo] = useState<TokenInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);
  const mint = cfg.token.mint;

  useEffect(() => {
    if (!mint) return;
    let alive = true;
    fetch("/api/token/info")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => alive && setInfo(j))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [mint]);

  const statusBadge = !mint ? (
    <Badge tone="amber">Not launched yet</Badge>
  ) : !info ? (
    <Badge>Loading…</Badge>
  ) : info.status === "bonding_curve" ? (
    <Badge tone="accent">Bonding curve · {info.bondingCurve?.progressPct.toFixed(1)}%</Badge>
  ) : info.status === "graduated" ? (
    <Badge tone="mint">Graduated · PumpSwap</Badge>
  ) : (
    <Badge tone="amber">Not found on {cfg.network}</Badge>
  );

  return (
    <div className="space-y-14">
      <TokenFlow buybackActive={cfg.token.buybackStatus === "active"} />

      <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14">
        <dl className="border-t border-line-2">
          <Fact label="Network">
            Solana <span className="text-dim">· {cfg.network}</span>
          </Fact>
          <Fact label="Token standard">
            {info?.onChain?.standard ?? <span className="text-ink-2">Set by the Pump program at launch (SPL / Token-2022)</span>}
          </Fact>
          <Fact label="Mint">
            {mint ? (
              <span className="flex flex-wrap items-center gap-2">
                <code className="font-mono text-[13px] break-all">{mint}</code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(mint).then(() => {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    });
                  }}
                  className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-0.5 text-[12px] text-ink-2 hover:text-ink"
                  aria-label="Copy mint address"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? "Copied" : "Copy"}
                </button>
              </span>
            ) : (
              <span className="text-ink-2">Published here at launch — verify it before you buy anything.</span>
            )}
          </Fact>
          <Fact label="Launch">pump.fun</Fact>
          <Fact label="Trading">
            <span className="flex flex-wrap items-center gap-2">
              Pump bonding curve → PumpSwap after graduation {statusBadge}
            </span>
          </Fact>
          <Fact label="Burn for credits">
            {cfg.payments.burnDiscountBps > 0
              ? `Burn $${cfg.token.symbol} for credits at ${cfg.payments.burnDiscountBps / 100}% off the USDC price — supply goes down with every purchase${cfg.token.mint ? "" : " (live at launch)"}.`
              : "Not enabled"}
          </Fact>
        </dl>

        <div className="card flex flex-col p-6">
          <div className="flex items-center justify-between">
            <span className="font-serif text-[30px] leading-none">${info?.symbol ?? cfg.token.symbol}</span>
            {mint && info ? <span className="font-mono text-[10.5px] text-dim">updated {new Date(info.fetchedAt).toLocaleTimeString()}</span> : null}
          </div>
          <div className="mt-6 grid grid-cols-3 gap-3">
            {[
              ["Price", info?.priceUsd != null ? formatUsd(info.priceUsd) : "—"],
              ["Market cap", info?.marketCapUsd != null ? formatCompactUsd(info.marketCapUsd) : "—"],
              ["Top 10 hold", info?.top10SharePct != null ? `${info.top10SharePct.toFixed(1)}%` : "—"],
            ].map(([k, v]) => (
              <div key={k}>
                <div className="eyebrow">{k}</div>
                <div className="mt-1.5 truncate text-[17px] font-medium tabular-nums">{v}</div>
              </div>
            ))}
          </div>
          {!mint ? <p className="mt-4 text-[12.5px] text-dim">Live figures appear once a mint is configured. Nothing here is estimated.</p> : null}
          {info?.status === "bonding_curve" && info.bondingCurve ? (
            <div className="mt-5">
              <div className="flex justify-between text-[12px] text-dim">
                <span>Bonding curve progress</span>
                <span>{info.bondingCurve.progressPct.toFixed(1)}%</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-sunken">
                <div className="h-full bg-ink" style={{ width: `${info.bondingCurve.progressPct}%` }} />
              </div>
            </div>
          ) : null}

          <div className="mt-auto grid gap-2 pt-6">
            <Button size="lg" disabled={!mint} onClick={() => setBuyOpen(true)}>
              Buy ${cfg.token.symbol}
            </Button>
            <div className="divide-y divide-line-2 overflow-hidden rounded-[10px] border border-line">
              {[
                ["View on pump.fun", cfg.token.links?.pump, ArrowUpRight, "Not launched yet"],
                ["View on Solana Explorer", cfg.token.links?.explorer, ArrowUpRight, "Not launched yet"],
                ["View chart", cfg.token.links?.chart, LineChart, mint ? "Charts index mainnet only" : "Not launched yet"],
              ].map(([label, href, Icon, why]) => {
                const I = Icon as typeof ArrowUpRight;
                const disabled = !href;
                return disabled ? (
                  <span key={label as string} className="flex h-10 items-center justify-between px-3.5 text-[13.5px] text-dim">
                    {label as string} <span className="text-[11.5px]">{why as string}</span>
                  </span>
                ) : (
                  <a
                    key={label as string}
                    href={href as string}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-10 items-center justify-between px-3.5 text-[13.5px] transition-colors hover:bg-sunken"
                  >
                    {label as string} <I size={14} className="text-dim" />
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      {buyOpen ? <BuyTokenModal open={buyOpen} onOpenChange={setBuyOpen} /> : null}
    </div>
  );
}
