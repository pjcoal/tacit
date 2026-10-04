"use client";

import { Bot, MessageSquare, Pencil, Plus, ShieldCheck, Trash2, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Segmented } from "@/components/ui/segmented";
import { AGENT_TEMPLATES, BLANK_AGENT, MAX_STARTERS, type AgentDraft } from "@/lib/agents/templates";
import { PRIVACY_MODE_INFO, sanitizePrompt } from "@/lib/privacy";
import { LIMITS } from "@/lib/security/uploads";
import { deleteAgent, listAgents, putAgent, uid, type Agent } from "@/lib/storage/db";
import { useLive } from "@/lib/storage/hooks";
import { cn } from "@/lib/utils";
import { AgentAvatar } from "./agent-avatar";

const field = "w-full rounded-xl border border-line bg-surface px-3 text-[14px] outline-none focus:border-ink/40";

type Editing = { id: string | null; draft: AgentDraft };

export function AgentsPage() {
  const router = useRouter();
  const { value: agents, ready } = useLive("agents", listAgents, []);
  const [editing, setEditing] = useState<Editing | null>(null);

  const save = async (e: Editing, thenChat: boolean) => {
    const now = Date.now();
    const existing = e.id ? agents.find((a) => a.id === e.id) : undefined;
    const agent: Agent = {
      ...e.draft,
      name: e.draft.name.trim(),
      description: e.draft.description.trim(),
      instructions: e.draft.instructions.trim(),
      starters: e.draft.starters.map((s) => s.trim()).filter(Boolean).slice(0, MAX_STARTERS),
      id: existing?.id ?? uid(),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await putAgent(agent);
    setEditing(null);
    if (thenChat) router.push(`/app?agent=${agent.id}`);
  };

  return (
    <div className="mx-auto max-w-[920px] px-5 py-8 sm:py-12">
      <PageHeader
        icon={Bot}
        title="Agents"
        description="Build your own assistants with their own instructions, starters and privacy settings. Agents are saved in this browser, and their instructions go through the same privacy filter as your messages."
        actions={
          <Button onClick={() => setEditing({ id: null, draft: { ...BLANK_AGENT } })} data-testid="new-agent">
            <Plus size={15} /> New agent
          </Button>
        }
      />

      <section aria-label="Your agents">
        {!ready ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {[0, 1].map((i) => (
              <div key={i} className="shimmer h-[132px] rounded-2xl" />
            ))}
          </div>
        ) : agents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line px-6 py-10 text-center">
            <p className="text-[15px] font-medium">No agents yet</p>
            <p className="mt-1 text-[13.5px] text-ink-2">Start from a template below, or build one from scratch.</p>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2" data-testid="agent-list">
            {agents.map((a) => (
              <li key={a.id} className="card flex flex-col p-5">
                <div className="flex items-start gap-3">
                  <AgentAvatar name={a.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15.5px] font-semibold">{a.name}</p>
                    <p className="mt-0.5 line-clamp-2 text-[13px] text-ink-2">{a.description || "No description."}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5 font-mono text-[10.5px] tracking-[0.06em] uppercase">
                  <span className="inline-flex items-center gap-1 rounded-md bg-accent-soft px-2 py-1 text-accent-ink">
                    <ShieldCheck size={11} /> {PRIVACY_MODE_INFO[a.privacyMode].label}
                  </span>
                  {a.solana ? (
                    <span className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-ink-2">
                      <Wallet size={11} /> Solana
                    </span>
                  ) : null}
                </div>
                <div className="mt-4 flex items-center gap-2 border-t border-line-2 pt-4">
                  <Link
                    href={`/app?agent=${a.id}`}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-ink px-3.5 text-[13px] font-medium text-bg transition-opacity hover:opacity-85"
                  >
                    <MessageSquare size={14} /> Chat
                  </Link>
                  <Button variant="secondary" size="sm" onClick={() => setEditing({ id: a.id, draft: toDraft(a) })} aria-label={`Edit ${a.name}`}>
                    <Pencil size={13} /> Edit
                  </Button>
                  <button
                    onClick={async () => {
                      if (confirm(`Delete "${a.name}" from this device? Past conversations stay.`)) await deleteAgent(a.id);
                    }}
                    className="ml-auto rounded-md p-2 text-dim hover:bg-danger-soft hover:text-danger"
                    aria-label={`Delete ${a.name}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12" aria-label="Templates">
        <h2 className="eyebrow mb-3">Start from a template</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {AGENT_TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => setEditing({ id: null, draft: { ...t, starters: [...t.starters] } })}
              className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4 text-left transition-colors hover:border-ink/30"
              data-testid={`template-${t.id}`}
            >
              <AgentAvatar name={t.name} size={36} />
              <span className="min-w-0">
                <span className="block text-[14.5px] font-medium">{t.name}</span>
                <span className="mt-0.5 block text-[13px] text-ink-2">{t.description}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      {editing ? <AgentEditor key={editing.id ?? "new"} initial={editing} onClose={() => setEditing(null)} onSave={save} /> : null}
    </div>
  );
}

function toDraft(a: Agent): AgentDraft {
  return { name: a.name, description: a.description, instructions: a.instructions, starters: [...a.starters], privacyMode: a.privacyMode, solana: a.solana };
}

function AgentEditor({ initial, onClose, onSave }: { initial: Editing; onClose: () => void; onSave: (e: Editing, thenChat: boolean) => Promise<void> }) {
  const [d, setD] = useState<AgentDraft>(initial.draft);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<AgentDraft>) => setD((x) => ({ ...x, ...patch }));
  const starters = [...d.starters, ...Array(Math.max(0, MAX_STARTERS - d.starters.length)).fill("")].slice(0, MAX_STARTERS);

  // Preview of what the model will actually receive for these instructions.
  const preview = useMemo(() => sanitizePrompt(`${d.name}\n${d.instructions}`, d.privacyMode), [d.name, d.instructions, d.privacyMode]);
  const replaced = preview.replacements.length;
  const valid = d.name.trim().length > 0;

  const submit = async (thenChat: boolean) => {
    if (!valid) return;
    setBusy(true);
    try {
      await onSave({ id: initial.id, draft: d }, thenChat);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()} wide title={initial.id ? "Edit agent" : "New agent"} description="Saved in this browser only.">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(false);
        }}
        className="space-y-5"
        data-testid="agent-editor"
      >
        <div className="flex items-start gap-3">
          <AgentAvatar name={d.name || "Agent"} size={44} />
          <div className="grid flex-1 gap-3 sm:grid-cols-2">
            <label className="block text-[13px] font-medium">
              Name
              <input value={d.name} onChange={(e) => set({ name: e.target.value })} maxLength={60} required placeholder="e.g. Code reviewer" className={`${field} mt-1.5 h-10`} />
            </label>
            <label className="block text-[13px] font-medium">
              Description
              <input value={d.description} onChange={(e) => set({ description: e.target.value })} maxLength={140} placeholder="What it's for, in one line" className={`${field} mt-1.5 h-10`} />
            </label>
          </div>
        </div>

        <label className="block text-[13px] font-medium">
          Instructions
          <textarea
            value={d.instructions}
            onChange={(e) => set({ instructions: e.target.value })}
            maxLength={LIMITS.maxAgentInstructions}
            rows={8}
            placeholder="Describe the role, what it should focus on, the tone, and the format of its answers."
            className={`${field} mt-1.5 resize-y py-2.5 leading-relaxed`}
          />
          <span className="mt-1 flex justify-between text-[11.5px] font-normal text-dim">
            <span className={cn(replaced ? "text-mint" : "")}>
              {replaced
                ? `${replaced} detail${replaced === 1 ? "" : "s"} here will be swapped for placeholders before sending.`
                : "Nothing personal detected in these instructions."}
            </span>
            <span className="tabular-nums">
              {d.instructions.length.toLocaleString("en-US")} / {LIMITS.maxAgentInstructions.toLocaleString("en-US")}
            </span>
          </span>
        </label>

        <fieldset>
          <legend className="text-[13px] font-medium">Conversation starters</legend>
          <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
            {starters.map((s, i) => (
              <input
                key={i}
                value={s}
                onChange={(e) => {
                  const next = [...starters];
                  next[i] = e.target.value;
                  set({ starters: next });
                }}
                maxLength={120}
                placeholder={`Starter ${i + 1} (optional)`}
                aria-label={`Starter ${i + 1}`}
                className={`${field} h-10`}
              />
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-[13px] font-medium">Privacy filter</p>
            <Segmented
              className="mt-1.5"
              size="sm"
              value={d.privacyMode}
              onChange={(v) => set({ privacyMode: v })}
              ariaLabel="Privacy filter"
              options={(["smart", "strict", "off"] as const).map((m) => ({ value: m, label: PRIVACY_MODE_INFO[m].label }))}
            />
            <p className="mt-1.5 text-[11.5px] text-dim">{PRIVACY_MODE_INFO[d.privacyMode].short}</p>
          </div>
          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-line p-3">
            <input type="checkbox" checked={d.solana} onChange={(e) => set({ solana: e.target.checked })} className="mt-1" />
            <span>
              <span className="flex items-center gap-1.5 text-[13px] font-medium">
                <Wallet size={13} /> Solana connector
              </span>
              <span className="mt-0.5 block text-[11.5px] text-dim">Lets the agent read your connected wallet and prepare transfers you approve yourself.</span>
            </span>
          </label>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-line-2 pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="secondary" disabled={!valid || busy} data-testid="save-agent">
            Save
          </Button>
          <Button type="button" disabled={!valid || busy} onClick={() => submit(true)} data-testid="save-and-chat">
            <MessageSquare size={14} /> Save &amp; chat
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
