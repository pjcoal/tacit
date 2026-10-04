"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";
import { LogOut, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { Spinner } from "@/components/ui/spinner";
import { WalletButton } from "@/components/wallet/wallet-button";
import { useWalletModal } from "@/components/wallet/wallet-provider";
import { useConfig } from "@/components/providers/config-provider";
import { shortAddress } from "@/lib/solana/address";
import { apiJson } from "@/lib/utils";

const AdminCtx = createContext<string | null>(null);
export const useAdminWallet = () => useContext(AdminCtx);

/** Gate admin pages behind a wallet-signed message from an ADMIN_WALLETS key. */
export function AdminGate({ children }: { children: ReactNode }) {
  const cfg = useConfig();
  const { publicKey, signMessage } = useWallet();
  const modal = useWalletModal();
  const [state, setState] = useState<{ configured: boolean; reason?: string; wallet: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => apiJson<{ configured: boolean; reason?: string; wallet: string | null }>("/api/admin/session").then(setState).catch((e) => setErr(e.message)), []);
  useEffect(() => {
    load();
  }, [load]);

  async function signIn() {
    if (!publicKey) return modal.open();
    if (!signMessage) return setErr("This wallet can't sign messages.");
    setBusy(true);
    setErr(null);
    try {
      const { message } = await apiJson<{ message: string }>("/api/auth/nonce", { method: "POST", json: { purpose: "admin" } });
      const sig = await signMessage(new TextEncoder().encode(message));
      await apiJson("/api/admin/session", { method: "POST", json: { publicKey: publicKey.toBase58(), signature: bs58.encode(sig), message } });
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh bg-bg">
      <header className="border-b border-line-2">
        <div className="container-x flex h-14 items-center gap-4">
          <Link href="/">
            <Logo name={cfg.appName} />
          </Link>
          <span className="rounded-md border border-line px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-wider text-dim">Admin · {cfg.network}</span>
          <nav className="ml-4 flex gap-4 text-[13.5px] text-ink-2">
            <Link href="/admin" className="hover:text-ink">Treasury</Link>
            <Link href="/admin/launch" className="hover:text-ink">Token launch</Link>
          </nav>
          <div className="ml-auto w-[220px]">
            <WalletButton compact />
          </div>
          {state?.wallet ? (
            <button
              onClick={async () => {
                await apiJson("/api/admin/session", { method: "DELETE" });
                load();
              }}
              className="rounded-md p-1.5 text-dim hover:text-ink"
              aria-label="Sign out"
            >
              <LogOut size={16} />
            </button>
          ) : null}
        </div>
      </header>
      <main className="container-x py-10">
        {!state ? (
          <div className="shimmer h-32 rounded-2xl" />
        ) : !state.configured ? (
          <div className="card max-w-xl p-6">
            <h1 className="text-[18px] font-semibold">Admin console not configured</h1>
            <p className="mt-2 text-[14px] text-ink-2">{state.reason}. Set ADMIN_WALLETS (comma-separated public keys) and SERVER_SECRET.</p>
          </div>
        ) : !state.wallet ? (
          <div className="card max-w-xl p-6">
            <ShieldCheck size={20} />
            <h1 className="mt-3 text-[18px] font-semibold">Sign in with an admin wallet</h1>
            <p className="mt-2 text-[14px] text-ink-2">You&apos;ll sign a text message (not a transaction). Sessions last 8 hours and are re-checked against ADMIN_WALLETS on every request.</p>
            <Button className="mt-5" onClick={signIn} disabled={busy}>
              {busy ? <Spinner /> : null} {publicKey ? `Sign in as ${shortAddress(publicKey.toBase58())}` : "Connect wallet"}
            </Button>
            {err ? <p className="mt-3 text-[13px] text-danger">{err}</p> : null}
          </div>
        ) : (
          <AdminCtx.Provider value={state.wallet}>{children}</AdminCtx.Provider>
        )}
      </main>
    </div>
  );
}
