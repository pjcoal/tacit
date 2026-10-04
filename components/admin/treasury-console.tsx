"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { ExternalLink } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useConfig } from "@/components/providers/config-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { formatBaseUnits } from "@/lib/credits/calc";
import { shortAddress } from "@/lib/solana/address";
import { assertTransactionShape, confirmSignature, decodeTransaction, PROGRAMS } from "@/lib/solana/client";
import { explorerTxUrl } from "@/lib/solana/links";
import { apiJson, formatUsd } from "@/lib/utils";

interface Proposal {
  id: string;
  periodStart: string;
  periodEnd: string;
  grossRevenueUsd: string;
  providerCostUsd: string;
  netRevenueUsd: string;
  allocationBps: number;
  proposedUsd: string;
  status: "proposed" | "approved" | "rejected" | "executed";
  createdBy: string;
  reviewedBy: string | null;
  notes: string | null;
}
interface Execution {
  id: string;
  proposalId: string | null;
  kind: "buy" | "burn";
  signature: string;
  quoteSpentBaseUnits: string | null;
  tokenAmountBaseUnits: string | null;
  status: string;
  error: string | null;
  executedBy: string;
  createdAt: string;
}
interface Overview {
  config: { treasury: string | null; mint: string | null; network: string; allocationBps: number; publicStatus: string; decimals: number };
  revenue: {
    allTime: { gross: number; providerCost: number; net: number };
    sinceLastProposal: { gross: number; providerCost: number; net: number; periodStart: string; proposedUsd: number };
  };
  totals: { boughtBaseUnits: string; burnedBaseUnits: string };
  userBurns: { baseUnits: string; count: number };
  proposals: Proposal[];
  executions: Execution[];
}

const STATUS_TONE = { proposed: "amber", approved: "accent", rejected: "neutral", executed: "mint" } as const;

export function TreasuryConsole() {
  const cfg = useConfig();
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [data, setData] = useState<Overview | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [slippage, setSlippage] = useState("2");
  const [burnAmount, setBurnAmount] = useState("");

  const load = useCallback(() => apiJson<Overview>("/api/admin/overview").then(setData).catch((e) => setErr(e.message)), []);
  useEffect(() => {
    load();
  }, [load]);

  const isTreasury = Boolean(publicKey && data?.config.treasury && publicKey.toBase58() === data.config.treasury);

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setErr(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function signAndLog(base64: string, kind: "buy" | "burn", proposalId?: string) {
    if (!publicKey) throw new Error("Connect the treasury wallet");
    const tx = decodeTransaction(base64);
    assertTransactionShape(tx, { feePayer: publicKey, allowed: kind === "buy" ? PROGRAMS.pumpTrade : PROGRAMS.burn });
    const sig = await sendTransaction(tx, connection);
    await confirmSignature(connection, sig, "confirmed");
    await apiJson("/api/admin/executions", { method: "POST", json: { kind, signature: sig, proposalId } });
  }

  if (!data) return err ? <p className="text-danger">{err}</p> : <div className="shimmer h-40 rounded-2xl" />;
  const dec = data.config.decimals;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="display text-[44px]">Treasury</h1>
        <p className="mt-2 max-w-2xl text-[14px] text-ink-2">
          Nothing here runs on a schedule or signs on its own. A proposal snapshots net revenue; an admin reviews it; the treasury wallet signs each transaction; the server verifies it on-chain before logging it.
        </p>
      </div>

      {err ? <p className="rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger">{err}</p> : null}

      <section className="grid gap-3 md:grid-cols-4">
        {[
          ["Treasury", data.config.treasury ? shortAddress(data.config.treasury, 6) : "Not set"],
          ["Token mint", data.config.mint ? shortAddress(data.config.mint, 6) : "Not set"],
          ["Allocation", `${data.config.allocationBps / 100}% of net`],
          ["Public status", data.config.publicStatus === "active" ? "Active" : "Planned"],
        ].map(([k, v]) => (
          <div key={k} className="card p-4">
            <div className="eyebrow">{k}</div>
            <div className="mt-2 font-mono text-[14px]">{v}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <div className="card p-5">
          <h2 className="text-[15px] font-semibold">Revenue ledger</h2>
          <dl className="mt-3 grid grid-cols-3 gap-3 text-[13px]">
            {(["gross", "providerCost", "net"] as const).map((k) => (
              <div key={k}>
                <dt className="text-dim">{k === "providerCost" ? "Provider cost" : k[0].toUpperCase() + k.slice(1)}</dt>
                <dd className="mt-0.5 text-[16px] font-medium tabular-nums">{formatUsd(data.revenue.allTime[k])}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-[12px] text-dim">All time. Gross = verified payments; provider cost = metered model spend.</p>
        </div>
        <div className="card p-5">
          <h2 className="text-[15px] font-semibold">Since last proposal</h2>
          <p className="mt-1 text-[12.5px] text-dim">from {new Date(data.revenue.sinceLastProposal.periodStart).toLocaleString()}</p>
          <div className="mt-3 text-[13.5px]">
            Net {formatUsd(data.revenue.sinceLastProposal.net)} → proposed buyback <strong className="tabular-nums">{formatUsd(data.revenue.sinceLastProposal.proposedUsd)}</strong>
          </div>
          <Button size="sm" className="mt-4" disabled={busy !== null || !data.config.mint} onClick={() => run("propose", () => apiJson("/api/admin/buyback/proposals", { method: "POST", json: {} }).then(() => {}))}>
            {busy === "propose" ? <Spinner /> : null} Create proposal
          </Button>
        </div>
      </section>

      <section className="card overflow-x-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
          <h2 className="text-[15px] font-semibold">Proposals</h2>
          <label className="flex items-center gap-2 text-[12.5px] text-ink-2">
            Max slippage
            <input value={slippage} onChange={(e) => setSlippage(e.target.value.replace(/[^0-9.]/g, ""))} className="h-8 w-14 rounded-md border border-line bg-surface px-2 text-right" aria-label="Slippage percent" />%
          </label>
        </div>
        {!isTreasury ? <p className="px-5 pt-2 text-[12.5px] text-amber">Connect the treasury wallet ({data.config.treasury ? shortAddress(data.config.treasury) : "not set"}) to execute.</p> : null}
        <table className="mt-3 w-full min-w-[760px] text-left text-[13px]">
          <thead className="border-y border-line bg-sunken font-mono text-[10.5px] uppercase tracking-wider text-dim">
            <tr>
              <th className="px-5 py-2.5 font-normal">Period</th>
              <th className="px-3 py-2.5 font-normal">Net</th>
              <th className="px-3 py-2.5 font-normal">Proposed</th>
              <th className="px-3 py-2.5 font-normal">Status</th>
              <th className="px-5 py-2.5 font-normal text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.proposals.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-4 text-dim">
                  No proposals yet.
                </td>
              </tr>
            ) : null}
            {data.proposals.map((p) => (
              <tr key={p.id} className="border-b border-line-2 last:border-0">
                <td className="px-5 py-3">
                  {new Date(p.periodStart).toLocaleDateString()} – {new Date(p.periodEnd).toLocaleDateString()}
                </td>
                <td className="px-3 py-3 tabular-nums">{formatUsd(Number(p.netRevenueUsd))}</td>
                <td className="px-3 py-3 tabular-nums">{formatUsd(Number(p.proposedUsd))}</td>
                <td className="px-3 py-3">
                  <Badge tone={STATUS_TONE[p.status]}>{p.status}</Badge>
                </td>
                <td className="px-5 py-3 text-right">
                  {p.status === "proposed" ? (
                    <span className="inline-flex gap-2">
                      <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => run(p.id, () => apiJson(`/api/admin/buyback/proposals/${p.id}`, { method: "POST", json: { action: "reject" } }).then(() => {}))}>
                        Reject
                      </Button>
                      <Button size="sm" disabled={busy !== null} onClick={() => run(p.id, () => apiJson(`/api/admin/buyback/proposals/${p.id}`, { method: "POST", json: { action: "approve" } }).then(() => {}))}>
                        Approve
                      </Button>
                    </span>
                  ) : p.status === "approved" ? (
                    <Button
                      size="sm"
                      disabled={busy !== null || !isTreasury}
                      onClick={() =>
                        run(p.id, async () => {
                          const r = await apiJson<{ transaction: string; lamports: string; solUsd: number }>("/api/admin/buyback/prepare", { method: "POST", json: { proposalId: p.id, slippagePct: Number(slippage) || 2 } });
                          if (!confirm(`Spend ${(Number(r.lamports) / 1e9).toFixed(4)} SOL (≈ ${formatUsd(Number(p.proposedUsd))}) from the treasury on $${cfg.token.symbol}? Your wallet will ask again.`)) return;
                          await signAndLog(r.transaction, "buy", p.id);
                        })
                      }
                    >
                      {busy === p.id ? <Spinner /> : null} Execute with treasury
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card p-5">
        <h2 className="text-[15px] font-semibold">Burn treasury tokens</h2>
        <p className="mt-1 text-[13px] text-ink-2">An SPL burn from the treasury&apos;s token account. Supply decreases on-chain. Irreversible.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input value={burnAmount} onChange={(e) => setBurnAmount(e.target.value.replace(/[^0-9.]/g, ""))} placeholder={`Amount of $${cfg.token.symbol}`} className="h-9 w-56 rounded-lg border border-line bg-surface px-3 text-[13.5px]" aria-label="Burn amount" />
          <Button
            size="sm"
            variant="danger"
            className="h-9"
            disabled={busy !== null || !isTreasury || !(Number(burnAmount) > 0)}
            onClick={() =>
              run("burn", async () => {
                if (!confirm(`Burn ${burnAmount} $${cfg.token.symbol} from the treasury? This cannot be undone.`)) return;
                const r = await apiJson<{ transaction: string }>("/api/admin/burn/prepare", { method: "POST", json: { amount: Number(burnAmount) } });
                await signAndLog(r.transaction, "burn");
                setBurnAmount("");
              })
            }
          >
            {busy === "burn" ? <Spinner /> : null} Prepare burn
          </Button>
        </div>
      </section>

      <section className="card overflow-x-auto">
        <div className="flex items-center justify-between px-5 pt-5">
          <h2 className="text-[15px] font-semibold">Execution log</h2>
          <span className="font-mono text-[11.5px] text-dim">
            bought {formatBaseUnits(BigInt(data.totals.boughtBaseUnits), dec, 2)} · treasury burned {formatBaseUnits(BigInt(data.totals.burnedBaseUnits), dec, 2)} · users burned{" "}
            {formatBaseUnits(BigInt(data.userBurns.baseUnits), dec, 2)} ({data.userBurns.count})
          </span>
        </div>
        <table className="mt-3 w-full min-w-[640px] text-left text-[13px]">
          <tbody>
            {data.executions.length === 0 ? (
              <tr>
                <td className="px-5 py-4 text-dim">Nothing executed.</td>
              </tr>
            ) : null}
            {data.executions.map((x) => (
              <tr key={x.id} className="border-t border-line-2">
                <td className="px-5 py-3">
                  <Badge tone={x.kind === "burn" ? "danger" : "accent"}>{x.kind}</Badge>
                </td>
                <td className="px-3 py-3 tabular-nums">{x.tokenAmountBaseUnits ? formatBaseUnits(BigInt(x.tokenAmountBaseUnits), dec, 2) : "—"}</td>
                <td className="px-3 py-3">{x.status === "verified" ? <Badge tone="mint">verified</Badge> : <Badge tone="danger">{x.status}</Badge>}</td>
                <td className="px-3 py-3 text-dim">{x.error ?? new Date(x.createdAt).toLocaleString()}</td>
                <td className="px-5 py-3 text-right">
                  <a href={explorerTxUrl(x.signature, cfg.network)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono text-[12px] hover:underline">
                    {shortAddress(x.signature, 6)} <ExternalLink size={11} />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
