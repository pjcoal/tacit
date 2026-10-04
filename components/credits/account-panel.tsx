"use client";

import { Check, Copy, Download, FileLock2, KeyRound, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { downloadVaultFile, useAccount } from "@/components/app/account-provider";
import { useConfig } from "@/components/providers/config-provider";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { findPlainAccountKey, MIN_PASSPHRASE_LENGTH, openVault, parseVaultFile, passphraseProblem, sealVault, type VaultFile } from "@/lib/vault";

const inputCls = "h-11 w-full min-w-0 rounded-xl border border-line bg-surface px-3 text-[14px] outline-none focus:border-ink/40";

/** Create / restore the pseudonymous account. Used by Credits and Developers. */
export function AccountGate({ reason }: { reason: string }) {
  const { appName } = useConfig();
  const { create, restore, refresh, unavailable } = useAccount();
  const fileName = `${appName.toLowerCase()}-vault.json`;

  // Create flow: passphrase → account + encrypted vault download → confirm saved.
  const [step, setStep] = useState<"passphrase" | "saved" | null>(null);
  const [pass, setPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [secret, setSecret] = useState<string | null>(null);
  const [vault, setVault] = useState<VaultFile | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Restore flow: vault file + passphrase, or a plain key from an older recovery file.
  const fileInput = useRef<HTMLInputElement>(null);
  const [restoreVault, setRestoreVault] = useState<VaultFile | null>(null);
  const [restorePass, setRestorePass] = useState("");
  const [restoreKey, setRestoreKey] = useState("");
  const [restoring, setRestoring] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const finish = () => {
    setStep(null);
    setSecret(null);
    setVault(null);
    refresh();
  };

  const submitPassphrase = async () => {
    const problem = passphraseProblem(pass, confirmPass);
    if (problem) return setCreateErr(problem);
    setCreateErr(null);
    setBusy(true);
    try {
      const s = await create();
      setSecret(s);
      try {
        const v = await sealVault(s, pass);
        setVault(v);
        downloadVaultFile(appName, v);
      } catch {
        // The account exists either way; fall back to showing the plain key.
        setVault(null);
      }
      setPass("");
      setConfirmPass("");
      setStep("saved");
    } catch (e) {
      setCreateErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const restoreWith = async (fn: () => Promise<string>) => {
    setErr(null);
    setRestoring(true);
    try {
      await restore(await fn());
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setRestoring(false);
    }
  };

  const onFile = async (file: File | undefined) => {
    setErr(null);
    setRestoreVault(null);
    if (!file) return;
    if (file.size > 64 * 1024) return setErr("That file is too large to be a vault file.");
    const text = await file.text();
    try {
      const v = parseVaultFile(text);
      if (v) return setRestoreVault(v);
    } catch (e) {
      return setErr((e as Error).message);
    }
    const plain = findPlainAccountKey(text);
    if (plain) return restoreWith(async () => plain);
    setErr("That file doesn't contain a vault or recovery key.");
  };

  return (
    <div className="card p-6 sm:p-7" data-testid="account-gate">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line bg-bg">
          <KeyRound size={17} />
        </span>
        <div>
          <h2 className="text-[17px] font-semibold">Create a private account</h2>
          <p className="mt-1 max-w-prose text-[14px] text-ink-2">
            {reason} There&apos;s no email or password. Your account key is encrypted in this browser with a passphrase only you know, and saved
            as a vault file. We store only a hash of the key.
          </p>
        </div>
      </div>
      {unavailable ? <p className="mt-4 text-[13px] text-danger">{unavailable}</p> : null}
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div>
          <Button
            size="lg"
            className="w-full"
            onClick={() => {
              setCreateErr(null);
              setSaved(false);
              setStep("passphrase");
            }}
            data-testid="create-account"
          >
            Create account
          </Button>
          <p className="mt-2 text-[12px] text-dim">You&apos;ll choose a passphrase, then your encrypted vault file downloads.</p>
        </div>

        <div className="space-y-2.5">
          <input
            ref={fileInput}
            type="file"
            accept=".json,.txt,application/json,text/plain"
            className="hidden"
            onChange={(e) => {
              onFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          {restoreVault ? (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                restoreWith(() => openVault(restoreVault, restorePass));
              }}
            >
              <input
                type="password"
                value={restorePass}
                onChange={(e) => setRestorePass(e.target.value)}
                placeholder="Vault passphrase"
                aria-label="Vault passphrase"
                autoComplete="current-password"
                autoFocus
                className={`${inputCls} h-12`}
              />
              <Button type="submit" size="lg" variant="secondary" disabled={!restorePass || restoring}>
                {restoring ? <Spinner /> : null} Unlock
              </Button>
            </form>
          ) : (
            <Button size="lg" variant="secondary" className="w-full" onClick={() => fileInput.current?.click()} disabled={restoring}>
              {restoring ? <Spinner /> : <Upload size={15} />} Restore from vault file
            </Button>
          )}
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              restoreWith(async () => findPlainAccountKey(restoreKey) ?? restoreKey.trim());
            }}
          >
            <input
              value={restoreKey}
              onChange={(e) => setRestoreKey(e.target.value)}
              placeholder="Or paste a plain recovery key"
              aria-label="Recovery key"
              className={`${inputCls} font-mono text-[12.5px]`}
            />
            <Button type="submit" variant="ghost" disabled={!restoreKey.trim() || restoring}>
              Restore
            </Button>
          </form>
        </div>
      </div>
      {err ? <p className="mt-3 text-[13px] text-danger">{err}</p> : null}

      <Dialog
        open={step === "passphrase"}
        onOpenChange={(v) => {
          if (!v && !busy) setStep(null);
        }}
        title="Choose a vault passphrase"
        description="Your account key is encrypted with this before it's saved. It never leaves this browser, and we can't reset it for you."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitPassphrase();
          }}
          className="space-y-3"
        >
          <label className="block text-[13px] font-medium">
            Passphrase
            <input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              autoComplete="new-password"
              autoFocus
              className={`${inputCls} mt-1.5`}
            />
          </label>
          <label className="block text-[13px] font-medium">
            Confirm passphrase
            <input type="password" value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)} autoComplete="new-password" className={`${inputCls} mt-1.5`} />
          </label>
          <p className="text-[12px] text-dim">At least {MIN_PASSPHRASE_LENGTH} characters. A few unrelated words work well.</p>
          {createErr ? <p className="text-[13px] text-danger">{createErr}</p> : null}
          <Button type="submit" className="w-full" disabled={busy} data-testid="create-vault">
            {busy ? <Spinner /> : null} {busy ? "Encrypting…" : "Create account"}
          </Button>
        </form>
      </Dialog>

      <Dialog
        open={step === "saved"}
        onOpenChange={(v) => {
          if (!v && saved) finish();
        }}
        title={vault ? "Save your vault file" : "Save your recovery key"}
        description={
          vault
            ? "To restore your account on another device you'll need this file and your passphrase. Without both, your credits can't be recovered."
            : "This is the only time it's shown. Without it, credits can't be recovered on another device."
        }
      >
        {vault ? (
          <div className="flex items-center gap-3 rounded-xl border border-line bg-sunken p-3">
            <FileLock2 size={18} className="shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-mono text-[12.5px]">{fileName}</p>
              <p className="text-[12px] text-dim">Encrypted · AES-256-GCM</p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => downloadVaultFile(appName, vault)}>
              <Download size={14} /> Download again
            </Button>
          </div>
        ) : null}
        <details className={vault ? "mt-4 text-[13px]" : "text-[13px]"} open={!vault}>
          {vault ? <summary className="cursor-pointer text-ink-2 select-none">Show the unencrypted key</summary> : null}
          {vault ? <p className="mt-2 text-[12px] text-dim">Anyone who sees this key can use your credits. Only copy it somewhere you trust.</p> : null}
          <div className="mt-2 rounded-xl border border-line bg-sunken p-3 font-mono text-[12.5px] break-all" data-testid="recovery-key">
            {secret}
          </div>
          <Button className="mt-2" variant="secondary" size="sm" onClick={() => secret && navigator.clipboard.writeText(secret).then(() => setCopied(true))}>
            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}
          </Button>
        </details>
        <label className="mt-5 flex items-start gap-2.5 text-[13.5px]">
          <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="mt-1" />
          {vault ? "I've saved my vault file and I'll remember the passphrase." : "I've saved my recovery key somewhere safe."}
        </label>
        <Button className="mt-4 w-full" disabled={!saved} onClick={finish} data-testid="saved-key">
          Continue
        </Button>
      </Dialog>
    </div>
  );
}
