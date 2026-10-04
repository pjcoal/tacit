"use client";

import type { Adapter, WalletError } from "@solana/wallet-adapter-base";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useConfig } from "@/components/providers/config-provider";
import { rpcEndpoint } from "@/lib/solana/client";
import { WalletModal } from "./wallet-modal";

interface WalletModalCtx {
  open: () => void;
  close: () => void;
  visible: boolean;
}
const ModalContext = createContext<WalletModalCtx | null>(null);

export function useWalletModal(): WalletModalCtx {
  const c = useContext(ModalContext);
  if (!c) throw new Error("useWalletModal outside SolanaProviders");
  return c;
}

/**
 * Wallet-standard wallets (Phantom, Solflare, Backpack, …) are discovered
 * automatically; no per-wallet adapters are bundled. WalletConnect is added
 * only when a project id is configured.
 */
export function SolanaProviders({ children }: { children: ReactNode }) {
  const cfg = useConfig();
  const endpoint = useMemo(() => rpcEndpoint(cfg.publicRpcUrl), [cfg.publicRpcUrl]);
  const [extra, setExtra] = useState<Adapter[]>([]);
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!cfg.walletConnectProjectId) return;
    let alive = true;
    import("@solana/wallet-adapter-walletconnect")
      .then(({ WalletConnectWalletAdapter }) => {
        if (!alive) return;
        const network = cfg.network === "mainnet-beta" ? "mainnet-beta" : "devnet";
        setExtra([
          new WalletConnectWalletAdapter({
            network: network as never,
            options: { projectId: cfg.walletConnectProjectId!, metadata: { name: cfg.appName, description: cfg.appName, url: cfg.appUrl, icons: [`${cfg.appUrl}/icon.svg`] } },
          }),
        ]);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [cfg.walletConnectProjectId, cfg.network, cfg.appName, cfg.appUrl]);

  const onError = useCallback((e: WalletError) => {
    if (e.name === "WalletNotReadyError") return;
    setError(e.message || e.name);
  }, []);

  const modal = useMemo(() => ({ open: () => setVisible(true), close: () => setVisible(false), visible }), [visible]);

  return (
    <ConnectionProvider endpoint={endpoint} config={{ commitment: "confirmed", wsEndpoint: cfg.publicRpcUrl ? undefined : "ws://127.0.0.1:1" }}>
      <WalletProvider wallets={extra} autoConnect onError={onError}>
        <ModalContext.Provider value={modal}>
          {children}
          <WalletModal open={visible} onOpenChange={setVisible} error={error} clearError={() => setError(null)} />
        </ModalContext.Provider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
