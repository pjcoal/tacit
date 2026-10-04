import { getMint, getTokenMetadata, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey, type Connection } from "@solana/web3.js";

export const METAPLEX_METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

export interface MintInfo {
  mint: string;
  programId: string;
  standard: "SPL Token" | "Token-2022";
  decimals: number;
  supply: bigint;
  mintAuthority: string | null;
  freezeAuthority: string | null;
  name: string | null;
  symbol: string | null;
  uri: string | null;
}

function readBorshString(buf: Uint8Array, offset: number): [string, number] {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const len = view.getUint32(offset, true);
  const start = offset + 4;
  const str = new TextDecoder().decode(buf.subarray(start, start + len)).replace(/\0+$/, "").trim();
  return [str, start + len];
}

/** Decode name/symbol/uri from a Metaplex Token Metadata account (v1 layout prefix). */
export function decodeMetaplexMetadata(data: Uint8Array): { name: string; symbol: string; uri: string } | null {
  try {
    const start = 1 + 32 + 32; // key, update authority, mint
    const [name, o1] = readBorshString(data, start);
    const [symbol, o2] = readBorshString(data, o1);
    const [uri] = readBorshString(data, o2);
    return { name, symbol, uri };
  } catch {
    return null;
  }
}

export async function readMintInfo(conn: Connection, mint: PublicKey): Promise<MintInfo> {
  const account = await conn.getAccountInfo(mint);
  if (!account) throw new Error("Mint account not found");
  const programId = account.owner;
  if (!programId.equals(TOKEN_PROGRAM_ID) && !programId.equals(TOKEN_2022_PROGRAM_ID)) {
    throw new Error("Address is not an SPL token mint");
  }
  const info = await getMint(conn, mint, "confirmed", programId);

  let name: string | null = null;
  let symbol: string | null = null;
  let uri: string | null = null;
  if (programId.equals(TOKEN_2022_PROGRAM_ID)) {
    const md = await getTokenMetadata(conn, mint, "confirmed", TOKEN_2022_PROGRAM_ID).catch(() => null);
    if (md) ({ name, symbol, uri } = md);
  }
  if (!name) {
    const [pda] = PublicKey.findProgramAddressSync(
      [new TextEncoder().encode("metadata"), METAPLEX_METADATA_PROGRAM_ID.toBytes(), mint.toBytes()],
      METAPLEX_METADATA_PROGRAM_ID,
    );
    const md = await conn.getAccountInfo(pda).catch(() => null);
    const decoded = md ? decodeMetaplexMetadata(md.data) : null;
    if (decoded) ({ name, symbol, uri } = decoded);
  }

  return {
    mint: mint.toBase58(),
    programId: programId.toBase58(),
    standard: programId.equals(TOKEN_2022_PROGRAM_ID) ? "Token-2022" : "SPL Token",
    decimals: info.decimals,
    supply: info.supply,
    mintAuthority: info.mintAuthority?.toBase58() ?? null,
    freezeAuthority: info.freezeAuthority?.toBase58() ?? null,
    name,
    symbol,
    uri,
  };
}
