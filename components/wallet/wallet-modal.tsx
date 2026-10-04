"use client";

import { WalletReadyState } from "@solana/wallet-adapter-base";
import { useWallet } from "@solana/wallet-adapter-react";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { useEffect } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";

const SUGGESTED = [
  { name: "Phantom", url: "https://phantom.com/download" },
  { name: "Solflare", url: "https://solflare.com/download" },
  { name: "Backpack", url: "https://backpack.app/download" },
];

export function WalletModal({
  open,
  onOpenChange,
  error,
  clearError,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  error: string | null;
  clearError: () => void;
}) {
  const { wallets, select, connecting, connected, wallet } = useWallet();

  useEffect(() => {
    if (connected && open) onOpenChange(false);
  }, [connected, open, onOpenChange]);

  const detected = wallets.filter((w) => w.readyState === WalletReadyState.Installed || w.readyState === WalletReadyState.Loadable);
  const missing = SUGGESTED.filter((s) => !detected.some((d) => d.adapter.name.toLowerCase().includes(s.name.toLowerCase())));

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        clearError();
        onOpenChange(v);
      }}
      title="Connect a Solana wallet"
      description="Needed only for payments, token features and the Solana connector. Chat works without one."
    >
      <div className="space-y-2" data-testid="wallet-modal">
        {detected.length === 0 ? (
          <p className="rounded-xl border border-line bg-sunken px-4 py-3 text-[13.5px] text-ink-2">
            No Solana wallet was detected in this browser. Install one below, then reload this page.
          </p>
        ) : null}
        {detected.map((w) => (
          <button
            key={w.adapter.name}
            onClick={() => {
              clearError();
              select(w.adapter.name);
            }}
            className="flex h-14 w-full items-center gap-3 rounded-xl border border-line px-4 text-left transition-colors hover:border-ink/30 hover:bg-sunken"
          >
            {/* Wallet icons are data: URIs supplied by the installed wallet itself. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={w.adapter.icon} alt="" width={26} height={26} className="rounded-md" />
            <span className="flex-1 text-[15px] font-medium">{w.adapter.name}</span>
            {connecting && wallet?.adapter.name === w.adapter.name ? (
              <Spinner />
            ) : (
              <span className="font-mono text-[10.5px] uppercase tracking-wider text-mint">Detected</span>
            )}
          </button>
        ))}
        {missing.map((s) => (
          <a
            key={s.name}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-12 w-full items-center gap-3 rounded-xl px-4 text-[14px] text-ink-2 transition-colors hover:bg-sunken"
          >
            <span className="flex-1">Get {s.name}</span>
            <ArrowUpRight size={15} />
          </a>
        ))}
        {error ? <p className="rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger">{error}</p> : null}
        <p className="flex items-start gap-2 pt-3 text-[12.5px] text-dim">
          <ShieldCheck size={14} className="mt-0.5 shrink-0" />
          We will never ask for your recovery phrase or private key. Every transaction is shown in your wallet before you approve it.
        </p>
      </div>
    </Dialog>
  );
}
