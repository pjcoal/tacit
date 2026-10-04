"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { apiJson } from "@/lib/utils";

export interface AccountState {
  createdAt: string;
  balance: number;
  plan: { id: "pro" | "max"; endsAt: string } | null;
  tokenTier: string | null;
  tokenTierExpiresAt: string | null;
}

interface Ctx {
  account: AccountState | null;
  loading: boolean;
  /** Set when the server can't persist accounts (e.g. no database in production). */
  unavailable: string | null;
  refresh: () => Promise<void>;
  create: () => Promise<string>;
  restore: (secret: string) => Promise<void>;
  forget: () => Promise<void>;
}

const AccountContext = createContext<Ctx | null>(null);

export function useAccount() {
  const c = useContext(AccountContext);
  if (!c) throw new Error("useAccount outside AccountProvider");
  return c;
}

export function downloadRecoveryFile(appName: string, secret: string) {
  const body = [
    `${appName} account recovery key`,
    "",
    secret,
    "",
    "Keep this file private. Anyone with this key can use your credits.",
    "There is no email or password reset: this key is the only way to restore your account on another device.",
    `Created: ${new Date().toISOString()}`,
  ].join("\n");
  const url = URL.createObjectURL(new Blob([body], { type: "text/plain" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${appName.toLowerCase()}-recovery-key.txt`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<AccountState | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await apiJson<{ account: AccountState | null }>("/api/account");
      setAccount(r.account);
      setUnavailable(null);
    } catch (e) {
      setUnavailable((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    apiJson<{ account: AccountState | null }>("/api/account")
      .then((r) => alive && (setAccount(r.account), setUnavailable(null)))
      .catch((e) => alive && setUnavailable((e as Error).message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  /** Creates the account. Callers refresh() after the user has saved the recovery key, so the key dialog isn't unmounted. */
  const create = useCallback(async () => {
    const r = await apiJson<{ secret: string }>("/api/account", { method: "POST", json: {} });
    return r.secret;
  }, []);

  const restore = useCallback(
    async (secret: string) => {
      await apiJson("/api/account/restore", { method: "POST", json: { secret: secret.trim() } });
      await refresh();
    },
    [refresh],
  );

  const forget = useCallback(async () => {
    await apiJson("/api/account", { method: "DELETE" });
    setAccount(null);
  }, []);

  return <AccountContext.Provider value={{ account, loading, unavailable, refresh, create, restore, forget }}>{children}</AccountContext.Provider>;
}
