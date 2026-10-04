"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";
import { BadgeCheck } from "lucide-react";
import { useState } from "react";
import { useAccount } from "@/components/app/account-provider";
import { useConfig } from "@/components/providers/config-provider";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useWalletModal } from "@/components/wallet/wallet-provider";
import { apiJson } from "@/lib/utils";

/** Prove token holdings with a signed message (no transaction). Only the resulting tier is stored. */
export function TokenGate() {
  const cfg = useConfig();
  const { account, refresh } = useAccount();
  const { publicKey, signMessage } = useWallet();
  const modal = useWalletModal();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const active = account?.tokenTier && account.tokenTierExpiresAt;

  async function verify() {
    if (!publicKey) return modal.open();
    if (!signMessage) return setMsg("This wallet can't sign messages.");
    setBusy(true);
    setMsg(null);
    try {
      const { message } = await apiJson<{ message: string }>("/api/auth/nonce", { method: "POST", json: { purpose: "token_gate" } });
      const sig = await signMessage(new TextEncoder().encode(message));
      const r = await apiJson<{ tier: string | null; held: number; required: number }>("/api/account/token-gate", {
        method: "POST",
        json: { publicKey: publicKey.toBase58(), signature: bs58.encode(sig), message },
      });
      setMsg(r.tier ? `Verified: holding ${r.held.toLocaleString("en-US")} $${cfg.token.symbol}.` : `This wallet holds ${r.held.toLocaleString("en-US")}; ${r.required.toLocaleString("en-US")} needed.`);
      refresh();
    } catch (e) {
      const m = (e as Error).message;
      setMsg(/reject|declin|cancel/i.test(m) ? "Signature declined." : m);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-6">
      <div className="flex items-center gap-2">
        <BadgeCheck size={17} />
        <h3 className="text-[15px] font-semibold">${cfg.token.symbol} holder benefits</h3>
      </div>
      <p className="mt-2 text-[13.5px] text-ink-2">
        Holders get 3× the daily free messages for 24 hours after verifying. You sign a message — not a transaction — and we store only &ldquo;holder until&rdquo;, never your address.
      </p>
      {!cfg.token.mint ? (
        <p className="mt-4 text-[13px] text-dim">Available after the token launches.</p>
      ) : active ? (
        <p className="mt-4 text-[13.5px] text-mint">Active until {new Date(account!.tokenTierExpiresAt!).toLocaleString()}</p>
      ) : (
        <Button variant="secondary" className="mt-4" onClick={verify} disabled={busy || !account}>
          {busy ? <Spinner /> : null} {publicKey ? "Verify holdings" : "Connect wallet to verify"}
        </Button>
      )}
      {!account && cfg.token.mint ? <p className="mt-2 text-[12px] text-dim">Create an account first.</p> : null}
      {msg ? <p className="mt-3 text-[13px] text-ink-2">{msg}</p> : null}
    </div>
  );
}
