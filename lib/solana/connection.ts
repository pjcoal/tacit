import "server-only";
import { Connection } from "@solana/web3.js";
import { env } from "@/server/env";

const GENESIS: Record<string, string> = {
  "mainnet-beta": "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d",
  devnet: "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG",
  testnet: "4uhcVJyU9pJkvQyS88uRDiswHXSCkY3zQawwpjk2NsNY",
};

let connection: Connection | null = null;
let clusterCheck: Promise<void> | null = null;

/** Server-side RPC connection. SOLANA_RPC_URL may contain a provider API key, so it never reaches the browser. */
export function getConnection(): Connection {
  connection ??= new Connection(env().rpcUrl, { commitment: "confirmed", disableRetryOnRateLimit: false });
  return connection;
}

/**
 * Verify once per process that the RPC actually serves the configured cluster,
 * so a devnet RPC can never be used to "verify" mainnet payments (or vice versa).
 */
export async function getVerifiedConnection(): Promise<Connection> {
  const conn = getConnection();
  clusterCheck ??= conn
    .getGenesisHash()
    .then((hash) => {
      const expected = GENESIS[env().SOLANA_NETWORK];
      if (hash !== expected) {
        throw new Error(`SOLANA_RPC_URL serves genesis ${hash}, expected ${env().SOLANA_NETWORK} (${expected}).`);
      }
    })
    .catch((err) => {
      clusterCheck = null;
      throw err;
    });
  await clusterCheck;
  return conn;
}
