"use client";

import { ArrowRight, ArrowUpRight, Check, Copy } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useConfig } from "@/components/providers/config-provider";
import { BurnVisual } from "@/components/token/burn-visual";
import { Reveal } from "@/components/ui/reveal";
import { cn, formatCompactUsd, formatUsd } from "@/lib/utils";
import type { TokenInfo } from "@/server/services/token-info";

// Wallet libraries are only downloaded when someone actually opens the buy flow.
const BuyTokenModal = dynamic(() => import("@/components/token/buy-token-modal").then((m) => m.BuyTokenModalStandalone), { ssr: false });

type Status = { label: string; tone: "live" | "launch" | "planned" };

function StatusTag({ s }: { s: Status }) {
  return (
    <span
      className={cn(
        "inline-flex h-[20px] items-center rounded-full px-2 font-mono text-[9.5px] tracking-[0.1em] uppercase",
        s.tone === "live" && "bg-[#3cc29e]/15 text-[#5fd6b4]",
        s.tone === "launch" && "bg-[#8d82ff]/15 text-[#b5aaff]",
        s.tone === "planned" && "bg-[#e0a24a]/15 text-[#e8b86a]",
      )}
    >
      {s.label}
    </span>
  );
}

export function TokenSection() {
  const cfg = useConfig();
  const [info, setInfo] = useState<TokenInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);
  const mint = cfg.token.mint;
  const sym = `$${cfg.token.symbol}`;
  const burnPct = cfg.payments.burnDiscountBps / 100;
  const buybackLive = cfg.token.buybackStatus === "active";

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

  const steps: Array<{ title: string; body: string; status: Status }> = [
    {
      title: `Pay with ${sym}`,
      body: `Tokens spent on credits or plans are burned on purchase — ${burnPct}% cheaper than USDC.`,
      status: mint ? { label: "Live", tone: "live" } : { label: "At launch", tone: "launch" },
    },
    { title: "Use Veil", body: "Chat, code and the API draw down those credits.", status: { label: "Live", tone: "live" } },
    { title: "Revenue", body: "SOL and USDC payments, each verified on-chain.", status: { label: "Live", tone: "live" } },
    {
      title: "Buyback & burn",
      body: "A share of net revenue buys and burns tokens — each step reviewed and signed by the treasury.",
      status: buybackLive ? { label: "Reviewed", tone: "live" } : { label: "Planned", tone: "planned" },
    },
  ];

  const trading =
    info?.status === "bonding_curve"
      ? `Bonding curve · ${info.bondingCurve?.progressPct.toFixed(1)}%`
      : info?.status === "graduated"
        ? "PumpSwap (graduated)"
        : "pump.fun → PumpSwap";

  const facts: Array<{ label: string; value: React.ReactNode; wide?: boolean }> = [
    { label: "Network", value: `Solana · ${cfg.network === "mainnet-beta" ? "mainnet" : cfg.network}` },
    { label: "Standard", value: info?.onChain?.standard ?? "SPL · Token-2022" },
    {
      label: "Mint",
      wide: true,
      value: mint ? (
        <button
          onClick={() =>
            navigator.clipboard.writeText(mint).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            })
          }
          className="group inline-flex max-w-full items-center gap-2 text-left font-mono text-[12.5px] break-all hover:text-white"
          aria-label="Copy mint address"
        >
          <span className="underline decoration-white/20 underline-offset-4">{mint}</span>
          {copied ? <Check size={13} className="shrink-0" /> : <Copy size={13} className="shrink-0 opacity-50 group-hover:opacity-100" />}
        </button>
      ) : (
        <span className="text-panel-dim">Published here at launch</span>
      ),
    },
    { label: "Trading", value: trading },
    ...(info?.priceUsd != null ? [{ label: "Price", value: formatUsd(info.priceUsd) }] : []),
    ...(info?.marketCapUsd != null ? [{ label: "Market cap", value: formatCompactUsd(info.marketCapUsd) }] : []),
  ];

  return (
    <section id="token" className="scroll-mt-20 bg-panel py-20 text-panel-ink md:py-28">
      <div className="container-x">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] [&>*]:min-w-0">
          <Reveal>
            <p className="font-mono text-[11px] tracking-[0.18em] text-[#b5aaff] uppercase">{sym} · on Solana</p>
            <h2 className="display mt-5 text-[clamp(44px,6.4vw,88px)] text-balance text-white">
              Spend it.
              <br />
              <span className="text-white/60">Shrink the supply.</span>
            </h2>
            <p className="mt-6 max-w-[54ch] text-[16.5px] leading-relaxed text-panel-dim">
              {sym} is how you pay for Veil at a discount — and every token spent is burned, so using the product takes supply out of
              circulation. A share of platform revenue is set aside to buy back and burn more; that part is planned, and labelled that way
              until it&apos;s live.
            </p>
            <div className="mt-8 flex flex-wrap gap-2.5">
              <button
                onClick={() => setBuyOpen(true)}
                disabled={!mint}
                className="group inline-flex h-12 items-center gap-2 rounded-xl bg-[#f2f1ec] px-6 text-[15px] font-medium text-[#0e0f11] transition-colors hover:bg-white disabled:opacity-60"
              >
                {mint ? `Buy ${sym}` : `${sym} launches soon`}
                {mint ? <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" /> : null}
              </button>
              {cfg.token.links ? (
                <a
                  href={cfg.token.links.explorer}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-12 items-center gap-1.5 rounded-xl border border-white/15 px-6 text-[15px] transition-colors hover:border-white/35"
                >
                  View on Solana Explorer <ArrowUpRight size={15} className="opacity-60" />
                </a>
              ) : null}
            </div>
            {cfg.token.links ? (
              <div className="mt-4 flex gap-5 text-[13px] text-panel-dim">
                <a href={cfg.token.links.pump} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-white">
                  View on pump.fun <ArrowUpRight size={12} />
                </a>
                {cfg.token.links.chart ? (
                  <a href={cfg.token.links.chart} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-white">
                    View chart <ArrowUpRight size={12} />
                  </a>
                ) : null}
              </div>
            ) : null}
          </Reveal>
          <Reveal delay={0.1}>
            <BurnVisual symbol={sym} standard={info?.onChain?.standard ?? "SPL"} discountPct={burnPct} />
          </Reveal>
        </div>

        <ol className="mt-16 grid grid-cols-1 border-y border-white/10 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <li
              key={s.title}
              className={cn(
                "relative py-7 sm:px-6 lg:py-8",
                i > 0 && "border-t border-white/10",
                i === 1 && "sm:border-t-0 sm:border-l",
                i === 2 && "sm:pl-0 lg:border-t-0 lg:border-l lg:pl-6",
                i === 3 && "sm:border-l lg:border-t-0",
                i === 0 && "sm:pl-0",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-[11px] text-panel-dim">0{i + 1}</span>
                <StatusTag s={s.status} />
              </div>
              <h3 className="mt-4 font-serif text-[28px] leading-none text-white">{s.title}</h3>
              <p className="mt-3 text-[14px] leading-relaxed text-panel-dim">{s.body}</p>
              {i < steps.length - 1 ? (
                <ArrowRight size={14} className="absolute top-1/2 -right-[7px] hidden -translate-y-1/2 bg-panel text-[#b5aaff] lg:block" aria-hidden />
              ) : null}
            </li>
          ))}
        </ol>

        <dl className={cn("mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10", facts.length > 4 ? "lg:grid-cols-7" : "lg:grid-cols-5")}>
          {facts.map((f, i) => (
            <div
              key={f.label}
              className={cn(
                "bg-panel-2 px-5 py-5",
                f.wide && "col-span-2",
                // Two-column phones: let a lone last cell span the row instead of leaving a gap.
                i === facts.length - 1 && facts.filter((x) => !x.wide).length % 2 === 1 && "col-span-2 lg:col-span-1",
              )}
            >
              <dt className="font-mono text-[10.5px] tracking-[0.14em] text-panel-dim uppercase">{f.label}</dt>
              <dd className="mt-2 text-[15px] text-white">{f.value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-[12px] text-panel-dim">Not financial advice. Tokens are volatile; only spend what you can afford to lose.</p>
      </div>
      {buyOpen ? <BuyTokenModal open={buyOpen} onOpenChange={setBuyOpen} /> : null}
    </section>
  );
}
