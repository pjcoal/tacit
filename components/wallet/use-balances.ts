"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useCallback, useEffect, useState } from "react";
import { useConfig } from "@/components/providers/config-provider";

export interface Balances {
  sol: number | null;
  token: number | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/** SOL + project-token balance of the connected wallet, read from the configured RPC. */
export function useBalances(): Balances {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const cfg = useConfig();
  const [tick, setTick] = useState(0);
  const key = publicKey ? `${publicKey.toBase58()}:${tick}` : null;
  // Results are tagged with the request key they belong to, so stale or signed-out data is never shown.
  const [result, setResult] = useState<{ key: string; sol: number | null; token: number | null; error: string | null } | null>(null);

  useEffect(() => {
    if (!publicKey || !key) return;
    let alive = true;
    (async () => {
      let sol: number | null = null;
      let token: number | null = null;
      let error: string | null = null;
      try {
        sol = (await connection.getBalance(publicKey, "confirmed")) / 1e9;
        if (cfg.token.mint) {
          const res = await connection.getParsedTokenAccountsByOwner(publicKey, { mint: new PublicKey(cfg.token.mint) }, "confirmed");
          token = res.value.reduce((n, a) => n + Number(a.account.data.parsed.info.tokenAmount.uiAmount ?? 0), 0);
        }
      } catch (e) {
        error = (e as Error).message;
      }
      if (alive) setResult({ key, sol, token, error });
    })();
    return () => {
      alive = false;
    };
  }, [publicKey, key, connection, cfg.token.mint]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  const current = result && result.key === key ? result : null;
  return { sol: current?.sol ?? null, token: current?.token ?? null, loading: Boolean(key) && !current, error: current?.error ?? null, refresh };
}
