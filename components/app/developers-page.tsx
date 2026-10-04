"use client";

import { KeyRound, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { CopyButton } from "@/components/chat/markdown";
import { AccountGate } from "@/components/credits/account-panel";
import { useConfig } from "@/components/providers/config-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Segmented } from "@/components/ui/segmented";
import { apiJson, timeAgo } from "@/lib/utils";
import { useAccount } from "./account-provider";
import { PageHeader } from "./page-header";
import { useModels } from "./use-models";

interface Key {
  id: string;
  name: string;
  displayPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

interface Usage {
  last30Days: { requests: number; inputTokens: number; outputTokens: number; credits: number };
  byKey: Array<{ apiKeyId: string | null; name: string; requests: number; credits: number }>;
  recent: Array<{ createdAt: string; source: string; kind: string; model: string; inputTokens: number; outputTokens: number; units: number; credits: number }>;
}

export function DevelopersPage() {
  const cfg = useConfig();
  const { account, loading } = useAccount();
  const { models } = useModels();
  const [keys, setKeys] = useState<Key[] | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [name, setName] = useState("");
  const [created, setCreated] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [lang, setLang] = useState<"curl" | "python" | "js">("curl");

  const load = useCallback(() => {
    apiJson<{ keys: Key[] }>("/api/keys").then((r) => setKeys(r.keys)).catch(() => setKeys([]));
    apiJson<Usage>("/api/account/usage").then(setUsage).catch(() => {});
  }, []);
  useEffect(() => {
    if (account) load();
  }, [account, load]);

  const base = `${cfg.appUrl}/api/v1`;
  const model = models?.chat.find((m) => m.available && m.id !== "auto")?.id ?? "auto";
  const examples = {
    curl: `curl ${base}/chat/completions \\
  -H "Authorization: Bearer $VEIL_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${model}",
    "stream": true,
    "privacy": "smart",
    "messages": [{"role": "user", "content": "Summarise the attached notes for Priya."}]
  }'`,
    python: `import os
from openai import OpenAI

client = OpenAI(base_url="${base}", api_key=os.environ["VEIL_API_KEY"])

stream = client.chat.completions.create(
    model="${model}",
    messages=[{"role": "user", "content": "Draft a reply to the landlord."}],
    stream=True,
    extra_body={"privacy": "smart"},  # optional server-side filtering
)
for chunk in stream:
    print(chunk.choices[0].delta.content or "", end="")`,
    js: `import OpenAI from "openai";

const client = new OpenAI({ baseURL: "${base}", apiKey: process.env.VEIL_API_KEY });

const res = await client.chat.completions.create({
  model: "${model}",
  messages: [{ role: "user", content: "Explain this stack trace." }],
  // @ts-expect-error extension
  privacy: "strict",
});
console.log(res.choices[0].message.content);`,
  };

  return (
    <div className="scrollbar-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-[920px] px-5 py-8 sm:py-12">
        <PageHeader icon={KeyRound} title="API" description="An OpenAI-compatible endpoint backed by the same models and credits as the app. Keys are hashed on our side and shown to you once." />

        {loading ? (
          <div className="shimmer h-40 rounded-2xl" />
        ) : !account ? (
          <AccountGate reason="API keys belong to an account so usage can be metered." />
        ) : (
          <>
            <section className="card p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-[16px] font-semibold">API keys</h2>
                <form
                  className="flex gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setErr(null);
                    try {
                      const r = await apiJson<{ key: { key: string } }>("/api/keys", { method: "POST", json: { name: name.trim() || "Default" } });
                      setCreated(r.key.key);
                      setName("");
                      load();
                    } catch (e2) {
                      setErr((e2 as Error).message);
                    }
                  }}
                >
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Key name" maxLength={48} aria-label="Key name" className="h-9 w-40 rounded-lg border border-line bg-surface px-3 text-[13.5px] outline-none focus:border-ink/40" />
                  <Button type="submit" size="sm" className="h-9" data-testid="create-key">
                    <Plus size={14} /> Create key
                  </Button>
                </form>
              </div>
              {err ? <p className="mt-3 text-[13px] text-danger">{err}</p> : null}
              {account.balance <= 0 ? <p className="mt-3 text-[13px] text-amber">The API bills credits only — this account has none yet.</p> : null}
              <ul className="mt-4 divide-y divide-line-2" data-testid="key-list">
                {keys === null ? <li className="shimmer h-10 rounded" /> : null}
                {keys?.length === 0 ? <li className="py-3 text-[13.5px] text-dim">No keys yet.</li> : null}
                {keys?.map((k) => (
                  <li key={k.id} className="flex flex-wrap items-center gap-3 py-3 text-[13.5px]">
                    <span className="font-medium">{k.name}</span>
                    <code className="font-mono text-[12px] text-dim">{k.displayPrefix}</code>
                    {k.revokedAt ? <Badge tone="danger">Revoked</Badge> : <Badge tone="mint">Active</Badge>}
                    <span className="text-[12px] text-dim">{k.lastUsedAt ? `used ${timeAgo(k.lastUsedAt)}` : `created ${timeAgo(k.createdAt)}`}</span>
                    {!k.revokedAt ? (
                      <button
                        className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12.5px] text-dim hover:bg-danger-soft hover:text-danger"
                        onClick={async () => {
                          if (!confirm(`Revoke "${k.name}"? Apps using it will stop working immediately.`)) return;
                          await apiJson(`/api/keys/${k.id}`, { method: "DELETE" });
                          load();
                        }}
                      >
                        <Trash2 size={13} /> Revoke
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>

            <section className="mt-6 grid gap-3 sm:grid-cols-4">
              {[
                ["Requests (30d)", usage?.last30Days.requests],
                ["Input tokens", usage?.last30Days.inputTokens],
                ["Output tokens", usage?.last30Days.outputTokens],
                ["Credits used", usage?.last30Days.credits],
              ].map(([k, v]) => (
                <div key={k as string} className="card p-4">
                  <div className="eyebrow">{k}</div>
                  <div className="mt-2 text-[22px] font-semibold tabular-nums">{v == null ? "—" : Number(v).toLocaleString("en-US")}</div>
                </div>
              ))}
            </section>
            {usage?.byKey.length ? (
              <section className="card mt-3 p-5">
                <h3 className="text-[14px] font-semibold">By key</h3>
                <ul className="mt-2 divide-y divide-line-2 text-[13px]">
                  {usage.byKey.map((k) => (
                    <li key={k.apiKeyId ?? k.name} className="flex justify-between py-2">
                      <span>{k.name}</span>
                      <span className="tabular-nums text-ink-2">
                        {k.requests} requests · {k.credits} credits
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        )}

        <section id="docs" className="mt-12 scroll-mt-6">
          <h2 className="text-[18px] font-semibold">Documentation</h2>
          <div className="mt-4 space-y-4 text-[14px] leading-relaxed text-ink-2">
            <p>
              <strong className="text-ink">Base URL</strong> <code className="rounded bg-sunken px-1.5 py-0.5 font-mono text-[12.5px]">{base}</code>. Authenticate with{" "}
              <code className="rounded bg-sunken px-1.5 py-0.5 font-mono text-[12.5px]">Authorization: Bearer veil_sk_…</code>.
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <code className="font-mono text-[12.5px]">POST /chat/completions</code> — <code className="font-mono text-[12.5px]">model</code>, <code className="font-mono text-[12.5px]">messages</code>, <code className="font-mono text-[12.5px]">stream</code>,{" "}
                <code className="font-mono text-[12.5px]">max_tokens</code>, <code className="font-mono text-[12.5px]">temperature</code>. Images as base64 <code className="font-mono text-[12.5px]">data:</code> URLs only.
              </li>
              <li>
                <code className="font-mono text-[12.5px]">GET /models</code> — models configured on this deployment.
              </li>
              <li>
                Extension: <code className="font-mono text-[12.5px]">&quot;privacy&quot;: &quot;smart&quot; | &quot;strict&quot; | &quot;off&quot;</code> runs the filter on our server and restores placeholders in the response. Default: off. Unlike the app, your raw text reaches our server in
                this mode (it is not stored or logged).
              </li>
              <li>Rate limit: 120 requests/minute per key. Responses include <code className="font-mono text-[12.5px]">x-ratelimit-*</code> headers.</li>
              <li>
                Billing: credits per token at each model&apos;s rate; <code className="font-mono text-[12.5px]">usage.credits</code> is returned with every response. Requests fail with 402 when the balance is empty.
              </li>
            </ul>
          </div>
          <div className="mt-5 overflow-hidden rounded-2xl border border-panel-line bg-panel">
            <div className="flex items-center justify-between border-b border-panel-line px-3 py-2">
              <Segmented ariaLabel="Example language" size="sm" value={lang} onChange={setLang} options={[{ value: "curl", label: "cURL" }, { value: "python", label: "Python" }, { value: "js", label: "JavaScript" }]} className="border-panel-line bg-white/5" />
              <CopyButton text={examples[lang]} className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[12px] text-panel-dim hover:text-panel-ink" />
            </div>
            <pre className="scrollbar-thin overflow-x-auto p-4 font-mono text-[12.5px] leading-[1.7] text-panel-ink">{examples[lang]}</pre>
          </div>
        </section>
      </div>

      <Dialog open={Boolean(created)} onOpenChange={(v) => !v && setCreated(null)} title="Your new API key" description="Copy it now — for your security we only store a hash and can't show it again.">
        <div className="rounded-xl border border-line bg-sunken p-3 font-mono text-[12.5px] break-all" data-testid="new-key">
          {created}
        </div>
        <div className="mt-3 flex justify-between">
          <CopyButton text={created ?? ""} label="Copy key" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-[13px]" />
          <Button size="sm" className="h-9" onClick={() => setCreated(null)}>
            Done
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
