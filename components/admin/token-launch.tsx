"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Keypair } from "@solana/web3.js";
import { AlertTriangle, CheckCircle2, ExternalLink, RefreshCw, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useConfig } from "@/components/providers/config-provider";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { assertTransactionShape, confirmSignature, decodeTransaction, PROGRAMS } from "@/lib/solana/client";
import { explorerAddressUrl, explorerTxUrl } from "@/lib/solana/links";
import { apiJson } from "@/lib/utils";
import { useAdminWallet } from "./admin-auth";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[13px] font-medium">{label}</span>
      {hint ? <span className="ml-2 text-[12px] text-dim">{hint}</span> : null}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
const input = "h-10 w-full rounded-lg border border-line bg-surface px-3 text-[14px] outline-none focus:border-ink/40";

export function TokenLaunch() {
  const cfg = useConfig();
  const admin = useAdminWallet();
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [f, setF] = useState({ name: cfg.token.name, symbol: cfg.token.symbol, description: "", website: cfg.appUrl, twitter: "", telegram: "", uri: "", initialBuySol: "0" });
  const [image, setImage] = useState<File | null>(null);
  // The mint keypair lives only in this tab's memory; it signs once and is discarded.
  const [mint, setMint] = useState(() => Keypair.generate());
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ signature: string; mint: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const mainnet = cfg.network === "mainnet-beta";
  const phrase = `LAUNCH ${f.symbol.toUpperCase()} ON MAINNET`;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const mintAddr = useMemo(() => mint.publicKey.toBase58(), [mint]);
  const walletMatches = publicKey?.toBase58() === admin;

  async function upload() {
    if (!image) return;
    setBusy("upload");
    setErr(null);
    try {
      const form = new FormData();
      form.append("image", image);
      for (const k of ["name", "symbol", "description", "website", "twitter", "telegram"] as const) form.append(k, f[k]);
      const res = await fetch("/api/admin/launch/metadata", { method: "POST", body: form });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Upload failed");
      setF((x) => ({ ...x, uri: j.uri }));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function launch() {
    if (!publicKey) return;
    setBusy("launch");
    setErr(null);
    try {
      const r = await apiJson<{ transaction: string; standard: string; network: string }>("/api/admin/launch/prepare", {
        method: "POST",
        json: { name: f.name, symbol: f.symbol, uri: f.uri, mint: mintAddr, initialBuySol: Number(f.initialBuySol) || 0, ...(mainnet ? { confirmMainnet: confirmText } : {}) },
      });
      const tx = decodeTransaction(r.transaction);
      assertTransactionShape(tx, { feePayer: publicKey, allowed: PROGRAMS.pumpLaunch });
      if (!confirm(`Create $${f.symbol} on ${r.network} (${r.standard})${Number(f.initialBuySol) > 0 ? ` and buy ${f.initialBuySol} SOL of it` : ""}? Your wallet will show the transaction.`)) return;
      // The mint keypair co-signs here; the admin wallet signs in its own UI.
      const sig = await sendTransaction(tx, connection, { signers: [mint] });
      await confirmSignature(connection, sig, "confirmed");
      setDone({ signature: sig, mint: mintAddr });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (done) {
    return (
      <div className="card max-w-2xl p-6">
        <CheckCircle2 size={28} className="text-mint" />
        <h1 className="mt-3 text-[20px] font-semibold">${f.symbol} created</h1>
        <p className="mt-2 text-[14px] text-ink-2">Set this in the server environment and redeploy so the site, payments and token info use it:</p>
        <pre className="mt-3 rounded-lg bg-panel p-3 font-mono text-[12.5px] text-panel-ink">PROJECT_TOKEN_MINT={done.mint}</pre>
        <div className="mt-4 flex gap-4 text-[13.5px]">
          <a href={explorerTxUrl(done.signature, cfg.network)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline">
            Transaction <ExternalLink size={12} />
          </a>
          <a href={explorerAddressUrl(done.mint, cfg.network)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline">
            Mint <ExternalLink size={12} />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <div>
        <h1 className="display text-[44px]">Token launch</h1>
        <p className="mt-2 max-w-2xl text-[14px] text-ink-2">Creates the coin with the official Pump SDK. Nothing is deployed until the admin wallet approves the transaction.</p>
        {cfg.token.mint ? (
          <p className="mt-4 rounded-lg border border-amber/30 bg-amber-soft px-3 py-2 text-[13px]">PROJECT_TOKEN_MINT is already set ({cfg.token.mint}). Launching again creates a different token.</p>
        ) : null}
        <div className={`mt-4 rounded-lg px-3 py-2 text-[13px] ${mainnet ? "bg-danger-soft text-danger" : "bg-mint-soft text-mint"}`}>
          Network: <strong>{cfg.network}</strong>
          {mainnet ? " — real funds. Requires ALLOW_MAINNET_TOKEN_CREATION=true and the confirmation phrase below." : " — test network. Pump program availability on this cluster is checked when you prepare."}
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field label="Name" hint="≤ 32">
            <input className={input} value={f.name} onChange={set("name")} maxLength={32} />
          </Field>
          <Field label="Ticker" hint="≤ 10">
            <input className={input} value={f.symbol} onChange={set("symbol")} maxLength={10} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Description">
              <textarea className={`${input} h-24 py-2`} value={f.description} onChange={set("description")} maxLength={1000} />
            </Field>
          </div>
          <Field label="Website">
            <input className={input} value={f.website} onChange={set("website")} />
          </Field>
          <Field label="X / Twitter">
            <input className={input} value={f.twitter} onChange={set("twitter")} placeholder="https://x.com/…" />
          </Field>
          <Field label="Telegram">
            <input className={input} value={f.telegram} onChange={set("telegram")} placeholder="https://t.me/…" />
          </Field>
          <Field label="Initial buy" hint="SOL, optional">
            <input className={input} value={f.initialBuySol} onChange={set("initialBuySol")} inputMode="decimal" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Image" hint="PNG/JPEG/WEBP/GIF ≤ 5 MB">
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
                  <Upload size={14} /> {image ? image.name : "Choose image"}
                </Button>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => setImage(e.target.files?.[0] ?? null)} />
                <Button size="sm" variant="secondary" disabled={!image || busy !== null} onClick={upload}>
                  {busy === "upload" ? <Spinner /> : null} Upload metadata to IPFS
                </Button>
              </div>
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Metadata URI" hint="from the upload, or your own https:// / ipfs:// JSON">
              <input className={`${input} font-mono text-[12.5px]`} value={f.uri} onChange={set("uri")} placeholder="https://…/metadata.json" />
            </Field>
          </div>
        </div>
      </div>

      <aside className="card h-fit p-5 lg:sticky lg:top-6">
        <div className="eyebrow">Mint address</div>
        <div className="mt-1.5 font-mono text-[12px] break-all">{mintAddr}</div>
        <button onClick={() => setMint(Keypair.generate())} className="mt-2 inline-flex items-center gap-1 text-[12px] text-dim hover:text-ink">
          <RefreshCw size={12} /> New address
        </button>
        <p className="mt-3 text-[12px] text-dim">Generated in this tab. Its secret never leaves the browser and is discarded after signing.</p>
        {mainnet ? (
          <label className="mt-4 block text-[12.5px]">
            Type <code className="font-mono">{phrase}</code>
            <input className={`${input} mt-1.5`} value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
          </label>
        ) : null}
        {!walletMatches ? <p className="mt-4 text-[12.5px] text-amber">Connect the signed-in admin wallet to launch.</p> : null}
        {err ? (
          <p className="mt-4 flex items-start gap-1.5 rounded-md bg-danger-soft px-2.5 py-2 text-[12.5px] text-danger">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {err}
          </p>
        ) : null}
        <Button className="mt-5 w-full" disabled={busy !== null || !walletMatches || !f.uri || !f.name || !f.symbol || (mainnet && confirmText !== phrase)} onClick={launch}>
          {busy === "launch" ? <Spinner /> : null} Prepare &amp; review launch
        </Button>
      </aside>
    </div>
  );
}
