"use client";

import * as DM from "@radix-ui/react-dropdown-menu";
import { useWallet } from "@solana/wallet-adapter-react";
import { Check, Copy, ExternalLink, LogOut, RefreshCw, Wallet } from "lucide-react";
import { useState } from "react";
import { useConfig } from "@/components/providers/config-provider";
import { Button } from "@/components/ui/button";
import { shortAddress } from "@/lib/solana/address";
import { explorerAddressUrl } from "@/lib/solana/links";
import { cn, formatNumber } from "@/lib/utils";
import { useBalances } from "./use-balances";
import { useWalletModal } from "./wallet-provider";

export function WalletButton({ className, compact }: { className?: string; compact?: boolean }) {
  const { publicKey, disconnect, wallet, connecting } = useWallet();
  const modal = useWalletModal();
  const cfg = useConfig();
  const { sol, token, loading, refresh } = useBalances();
  const [copied, setCopied] = useState(false);

  if (!publicKey) {
    return (
      <Button variant="secondary" size="sm" className={cn("w-full", className)} onClick={modal.open} disabled={connecting} data-testid="connect-wallet">
        <Wallet size={14} /> {connecting ? "Connecting…" : "Connect wallet"}
      </Button>
    );
  }
  const addr = publicKey.toBase58();
  return (
    <DM.Root>
      <DM.Trigger asChild>
        <button className={cn("flex h-9 w-full items-center gap-2 rounded-lg border border-line bg-surface px-2.5 text-left text-[13px] hover:border-ink/30", className)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {wallet ? <img src={wallet.adapter.icon} alt="" width={16} height={16} className="rounded" /> : <Wallet size={14} />}
          <span className="font-mono">{shortAddress(addr)}</span>
          {!compact ? <span className="ml-auto text-dim tabular-nums">{sol != null ? `${formatNumber(sol, 3)} SOL` : loading ? "…" : ""}</span> : null}
        </button>
      </DM.Trigger>
      <DM.Portal>
        <DM.Content align="start" sideOffset={6} className="z-[70] w-[260px] rounded-xl border border-line bg-surface p-1.5 text-[13px] shadow-[var(--shadow-pop)]">
          <div className="px-2.5 py-2">
            <div className="eyebrow">Connected</div>
            <div className="mt-1 font-mono text-[12px] break-all">{addr}</div>
            <dl className="mt-3 grid grid-cols-2 gap-2">
              <div>
                <dt className="text-dim">SOL</dt>
                <dd className="tabular-nums">{sol != null ? formatNumber(sol, 4) : "—"}</dd>
              </div>
              <div>
                <dt className="text-dim">${cfg.token.symbol}</dt>
                <dd className="tabular-nums">{cfg.token.mint ? (token != null ? formatNumber(token, 2) : "—") : "Not launched"}</dd>
              </div>
            </dl>
          </div>
          <DM.Separator className="my-1 h-px bg-line-2" />
          <DM.Item onSelect={(e) => { e.preventDefault(); navigator.clipboard.writeText(addr).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1200); }); }} className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 outline-none hover:bg-sunken focus:bg-sunken">
            {copied ? <Check size={14} /> : <Copy size={14} />} Copy address
          </DM.Item>
          <DM.Item onSelect={(e) => { e.preventDefault(); refresh(); }} className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 outline-none hover:bg-sunken focus:bg-sunken">
            <RefreshCw size={14} /> Refresh balances
          </DM.Item>
          <DM.Item asChild>
            <a href={explorerAddressUrl(addr, cfg.network)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-md px-2.5 py-2 outline-none hover:bg-sunken focus:bg-sunken">
              <ExternalLink size={14} /> View in explorer
            </a>
          </DM.Item>
          <DM.Item onSelect={() => disconnect()} className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-danger outline-none hover:bg-danger-soft focus:bg-danger-soft">
            <LogOut size={14} /> Disconnect
          </DM.Item>
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  );
}
