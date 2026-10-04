"use client";

import { Check, Copy, Download, KeyRound } from "lucide-react";
import { useState } from "react";
import { downloadRecoveryFile, useAccount } from "@/components/app/account-provider";
import { useConfig } from "@/components/providers/config-provider";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";

/** Create / restore the pseudonymous account. Used by Credits and Developers. */
export function AccountGate({ reason }: { reason: string }) {
  const { appName } = useConfig();
  const { create, restore, refresh, unavailable } = useAccount();
  const [secret, setSecret] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [restoreKey, setRestoreKey] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  return (
    <div className="card p-6 sm:p-7" data-testid="account-gate">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line bg-bg">
          <KeyRound size={17} />
        </span>
        <div>
          <h2 className="text-[17px] font-semibold">Create a private account</h2>
          <p className="mt-1 max-w-prose text-[14px] text-ink-2">
            {reason} There&apos;s no email or password — just a random recovery key you keep. We store only its hash.
          </p>
        </div>
      </div>
      {unavailable ? <p className="mt-4 text-[13px] text-danger">{unavailable}</p> : null}
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div>
          <Button
            size="lg"
            className="w-full"
            disabled={busy}
            onClick={async () => {
              setErr(null);
              setBusy(true);
              try {
                const s = await create();
                setSecret(s);
                downloadRecoveryFile(appName, s);
              } catch (e) {
                setErr((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
            data-testid="create-account"
          >
            {busy ? <Spinner /> : null} Create account
          </Button>
          <p className="mt-2 text-[12px] text-dim">Your recovery key downloads automatically.</p>
        </div>
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setErr(null);
            try {
              await restore(restoreKey);
            } catch (e2) {
              setErr((e2 as Error).message);
            }
          }}
        >
          <input
            value={restoreKey}
            onChange={(e) => setRestoreKey(e.target.value)}
            placeholder="Paste recovery key"
            aria-label="Recovery key"
            className="h-12 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 font-mono text-[12.5px] outline-none focus:border-ink/40"
          />
          <Button type="submit" size="lg" variant="secondary" disabled={!restoreKey.trim()}>
            Restore
          </Button>
        </form>
      </div>
      {err ? <p className="mt-3 text-[13px] text-danger">{err}</p> : null}

      <Dialog
        open={Boolean(secret)}
        onOpenChange={(v) => {
          if (!v && saved) {
            setSecret(null);
            refresh();
          }
        }} title="Save your recovery key" description="This is the only time it's shown. Without it, credits can't be recovered on another device.">
        <div className="rounded-xl border border-line bg-sunken p-3 font-mono text-[12.5px] break-all" data-testid="recovery-key">
          {secret}
        </div>
        <div className="mt-3 flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => secret && navigator.clipboard.writeText(secret).then(() => setCopied(true))}>
            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => secret && downloadRecoveryFile(appName, secret)}>
            <Download size={14} /> Download again
          </Button>
        </div>
        <label className="mt-5 flex items-start gap-2.5 text-[13.5px]">
          <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="mt-1" />
          I&apos;ve saved my recovery key somewhere safe.
        </label>
        <Button
          className="mt-4 w-full"
          disabled={!saved}
          onClick={() => {
            setSecret(null);
            refresh();
          }}
          data-testid="saved-key"
        >
          Continue
        </Button>
      </Dialog>
    </div>
  );
}
