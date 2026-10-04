export type SolanaNetwork = "devnet" | "testnet" | "mainnet-beta";

function clusterQuery(network: SolanaNetwork) {
  return network === "mainnet-beta" ? "" : `?cluster=${network}`;
}

export function explorerAddressUrl(address: string, network: SolanaNetwork) {
  return `https://explorer.solana.com/address/${address}${clusterQuery(network)}`;
}

export function explorerTxUrl(signature: string, network: SolanaNetwork) {
  return `https://explorer.solana.com/tx/${signature}${clusterQuery(network)}`;
}

export interface TokenLinks {
  pump: string;
  explorer: string;
  chart: string | null;
}

/** Links are always derived from the configured mint — never hard-coded. */
export function tokenLinks(mint: string, network: SolanaNetwork, pumpUrlOverride?: string): TokenLinks {
  return {
    pump: pumpUrlOverride ?? `https://pump.fun/coin/${mint}`,
    explorer: explorerAddressUrl(mint, network),
    // Third-party charts only index mainnet.
    chart: network === "mainnet-beta" ? `https://dexscreener.com/solana/${mint}` : null,
  };
}
