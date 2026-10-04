"use client";

import { Download, Settings as SettingsIcon, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { PRIVACY_MODE_INFO } from "@/lib/privacy";
import { exportAll, wipeAll } from "@/lib/storage/db";
import { useSettings } from "@/lib/storage/hooks";
import { useAccount } from "./account-provider";
import { PageHeader } from "./page-header";

function Row({ title, description, children }: { title: string; description: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b border-line-2 py-5 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="max-w-md">
        <div className="text-[14.5px] font-medium">{title}</div>
        <div className="mt-0.5 text-[13px] text-ink-2">{description}</div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function SettingsPage() {
  const { settings, update } = useSettings();
  const { account, forget } = useAccount();
  const [done, setDone] = useState<string | null>(null);

  return (
    <div className="scrollbar-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-[760px] px-5 py-8 sm:py-12">
        <PageHeader icon={SettingsIcon} title="Settings" description="Saved in this browser." />

        <section className="card px-5">
          <Row title="Appearance" description="Follows your system unless you pick one.">
            <Segmented ariaLabel="Theme" value={settings.theme} onChange={(v) => update({ theme: v })} options={[{ value: "system", label: "System" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} />
          </Row>
          <Row title="Default privacy mode" description={PRIVACY_MODE_INFO[settings.privacyMode].short}>
            <Segmented ariaLabel="Default privacy mode" value={settings.privacyMode} onChange={(v) => update({ privacyMode: v })} options={(["smart", "strict", "off"] as const).map((m) => ({ value: m, label: PRIVACY_MODE_INFO[m].label }))} />
          </Row>
        </section>

        <h2 className="eyebrow mt-10 mb-3">Solana connector</h2>
        <section className="card px-5">
          <Row title="Read wallet data" description="Balances, tokens and transaction history, fetched by this browser when the model asks.">
            <Segmented ariaLabel="Wallet reads" value={settings.solanaReads} onChange={(v) => update({ solanaReads: v })} options={[{ value: "auto", label: "Allow" }, { value: "never", label: "Never" }]} />
          </Row>
          <Row title="Prepare transactions" description="Transfers are always shown as a preview and need your wallet's approval. “Always” is not an option.">
            <Segmented ariaLabel="Transaction preparation" value={settings.solanaWrites} onChange={(v) => update({ solanaWrites: v })} options={[{ value: "ask", label: "Ask me" }, { value: "never", label: "Never" }]} />
          </Row>
        </section>

        <h2 className="eyebrow mt-10 mb-3">Data on this device</h2>
        <section className="card px-5">
          <Row title="Export" description="Conversations, code projects and settings as JSON. Images and videos are not included.">
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                const data = await exportAll();
                const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
                const a = document.createElement("a");
                a.href = url;
                a.download = `veil-export-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}
            >
              <Download size={14} /> Export
            </Button>
          </Row>
          <Row title="Delete all local data" description="Removes every conversation, placeholder map, image, video and project from this browser. This can't be undone.">
            <Button
              variant="danger"
              size="sm"
              onClick={async () => {
                if (!confirm("Delete all conversations, images, videos and projects from this browser?")) return;
                await wipeAll();
                setDone("Local data deleted.");
              }}
            >
              <Trash2 size={14} /> Delete
            </Button>
          </Row>
        </section>

        <h2 className="eyebrow mt-10 mb-3">Account</h2>
        <section className="card px-5">
          <Row
            title={account ? "Forget account on this device" : "No account on this device"}
            description={account ? "Signs this browser out. Your credits stay on the account and can be restored with your recovery key." : "Create one from Credits when you need to buy credits or API keys."}
          >
            {account ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={async () => {
                  if (!confirm("Make sure you have your recovery key. Forget this account on this device?")) return;
                  await forget();
                  setDone("Account removed from this device.");
                }}
              >
                Forget
              </Button>
            ) : null}
          </Row>
        </section>
        {done ? <p className="mt-4 text-[13px] text-mint" role="status">{done}</p> : null}
      </div>
    </div>
  );
}
