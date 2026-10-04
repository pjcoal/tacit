"use client";

import { createAssociatedTokenAccountIdempotentInstruction, createTransferCheckedInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { ComputeBudgetProgram, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { AlertTriangle, CheckCircle2, ExternalLink, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { useConfig } from "@/components/providers/config-provider";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useWalletModal } from "@/components/wallet/wallet-provider";
import { shortAddress } from "@/lib/solana/address";
import { assertTransactionShape, confirmSignature, PROGRAMS } from "@/lib/solana/client";
import { explorerTxUrl } from "@/lib/solana/links";
import type { StoredToolCall } from "@/lib/storage/db";

/**
 * The only path from an AI-prepared intent to a signed transaction: the user
 * reads the preview, clicks approve, and their wallet asks them again.
 */
export function TransferCard({ call, onUpdate }: { call: StoredToolCall; onUpdate: (patch: Partial<StoredToolCall>) => void }) {
  const p = call.preview!;
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const modal = useWalletModal();
  const { network } = useConfig();
  const [busy, setBusy] = useState<null | "sign" | "confirm">(null);
  const [err, setErr] = useState<string | null>(null);

  async function approve() {
    if (!publicKey) return modal.open();
    setErr(null);
    setBusy("sign");
    try {
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
      const tx = new Transaction({ feePayer: publicKey, blockhash, lastValidBlockHeight });
      tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 60_000 }));
      const to = new PublicKey(p.to);
      if (p.kind === "sol") {
        tx.add(SystemProgram.transfer({ fromPubkey: publicKey, toPubkey: to, lamports: BigInt(p.amountBase) }));
      } else {
        const mint = new PublicKey(p.mint!);
        const program = new PublicKey(p.tokenProgram!);
        const src = getAssociatedTokenAddressSync(mint, publicKey, false, program);
        const dst = getAssociatedTokenAddressSync(mint, to, true, program);
        tx.add(createAssociatedTokenAccountIdempotentInstruction(publicKey, dst, to, mint, program));
        tx.add(createTransferCheckedInstruction(src, mint, dst, publicKey, BigInt(p.amountBase), p.decimals!, [], program));
      }
      assertTransactionShape(tx, { feePayer: publicKey, allowed: PROGRAMS.payment });
      const sig = await sendTransaction(tx, connection);
      onUpdate({ status: "submitted", signature: sig });
      setBusy("confirm");
      await confirmSignature(connection, sig, "confirmed");
      onUpdate({ status: "confirmed", signature: sig });
    } catch (e) {
      const msg = (e as Error).message ?? "Failed";
      setErr(/reject|cancel|declin/i.test(msg) ? "You declined in your wallet. Nothing was sent." : msg);
    } finally {
      setBusy(null);
    }
  }

  const done = call.status === "confirmed";
  const rejected = call.status === "rejected";
  return (
    <div className="mt-3 max-w-md rounded-xl border border-ink/25 bg-surface p-4 text-[13.5px]" data-testid="transfer-card">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 font-medium">
          <ShieldAlert size={15} /> Transfer preview
        </span>
        <span className={`font-mono text-[10px] uppercase tracking-wider ${done ? "text-mint" : rejected ? "text-dim" : "text-amber"}`}>
          {done ? "Confirmed" : rejected ? "Declined" : call.status === "submitted" ? "Submitted" : "Needs your approval"}
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-[110px_1fr] gap-y-1.5">
        <dt className="text-dim">Amount</dt>
        <dd className="font-medium tabular-nums">
          {p.amountUi} {p.kind === "sol" ? "SOL" : p.symbol ?? shortAddress(p.mint!)}
        </dd>
        <dt className="text-dim">To</dt>
        <dd className="font-mono text-[12px] break-all">{p.to}</dd>
        {p.kind === "token" ? (
          <>
            <dt className="text-dim">Token</dt>
            <dd className="font-mono text-[12px] break-all">{p.mint}</dd>
          </>
        ) : null}
        <dt className="text-dim">Network fee</dt>
        <dd>≈ {(p.feeLamports / 1e9).toFixed(6)} SOL{p.createsRecipientAccount ? " + ~0.002 SOL rent for the recipient's token account" : ""}</dd>
        <dt className="text-dim">Network</dt>
        <dd>Solana {network}</dd>
      </dl>
      <p className="mt-3 text-[12px] text-ink-2">Prepared by the assistant from your request. Double-check the address — transfers can&apos;t be reversed.</p>
      {err ? (
        <p className="mt-2 flex items-start gap-1.5 rounded-md bg-danger-soft px-2.5 py-1.5 text-[12.5px] text-danger">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {err}
        </p>
      ) : null}
      {call.signature ? (
        <a href={explorerTxUrl(call.signature, network)} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-medium hover:underline">
          {done ? <CheckCircle2 size={13} className="text-mint" /> : null} View transaction <ExternalLink size={12} />
        </a>
      ) : null}
      {!done && !rejected && call.status !== "submitted" ? (
        <div className="mt-4 flex gap-2">
          <Button size="sm" onClick={approve} disabled={busy !== null} data-testid="approve-transfer">
            {busy ? <Spinner /> : null}
            {busy === "sign" ? "Check your wallet…" : busy === "confirm" ? "Confirming…" : publicKey ? "Review in wallet" : "Connect wallet"}
          </Button>
          <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => onUpdate({ status: "rejected" })}>
            Decline
          </Button>
        </div>
      ) : null}
    </div>
  );
}
