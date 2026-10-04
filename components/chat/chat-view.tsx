"use client";

import { ArrowDown, Lock, ShieldCheck, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAccount } from "@/components/app/account-provider";
import { useModels } from "@/components/app/use-models";
import { AgentAvatar } from "@/components/agents/agent-avatar";
import { useConfig } from "@/components/providers/config-provider";
import { PRIVACY_MODE_INFO } from "@/lib/privacy";
import { listAgents } from "@/lib/storage/db";
import { useLive, useSettings } from "@/lib/storage/hooks";
import { AssistantMessage, UserMessage } from "./message";
import { Composer, type ComposerSettings } from "./composer";
import { useChat } from "./use-chat";

export function ChatView() {
  const params = useSearchParams();
  const router = useRouter();
  const cid = params.get("c");
  const cfg = useConfig();
  const { account } = useAccount();
  const { models, error: modelsError } = useModels();
  const { settings, ready, update } = useSettings();
  // Per-conversation overrides on top of saved defaults; derived rather than synced in effects.
  const [overrides, setOverrides] = useState<{ id: string | null; v: Partial<ComposerSettings> }>({ id: null, v: {} });

  const onCreated = useCallback(
    (id: string) => {
      // Keep toggles chosen before the first message (e.g. Solana tools) for the new conversation.
      setOverrides((o) => (o.id === null ? { id, v: o.v } : o));
      router.replace(`/app?c=${id}`, { scroll: false });
    },
    [router],
  );
  // An agent comes from the conversation once it exists, or from ?agent= on a new chat.
  const { value: agents, ready: agentsReady } = useLive("agents", listAgents, []);
  const [convAgentId, setConvAgentId] = useState<string | null>(null);
  const agentId = cid ? convAgentId : params.get("agent");
  const agent = agentId ? (agents.find((a) => a.id === agentId) ?? null) : null;
  const chat = useChat(cid, onCreated, agent);
  const loadedAgentId = chat.conversation?.agentId ?? null;
  if (cid && !chat.loading && loadedAgentId !== convAgentId) setConvAgentId(loadedAgentId);

  const composer = useMemo<ComposerSettings | null>(() => {
    if (!ready) return null;
    const conv = chat.conversation;
    const own = overrides.id === (conv?.id ?? null) ? overrides.v : {};
    const c: ComposerSettings = {
      model: settings.model,
      mode: agent?.privacyMode ?? settings.privacyMode,
      reasoning: settings.reasoning,
      solana: agent?.solana ?? false,
      ...(conv ? { model: conv.model, mode: conv.privacyMode } : {}),
      ...own,
    };
    // The app always routes automatically; model choice is an API-only feature.
    c.model = "auto";
    return c;
  }, [ready, settings, chat.conversation, overrides, agent]);

  const scroller = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(true);
  useEffect(() => {
    const el = scroller.current;
    if (el && pinned) el.scrollTop = el.scrollHeight;
  }, [chat.messages, pinned]);

  const visible = chat.messages.filter((m) => m.role !== "tool");
  const lastAssistant = [...visible].reverse().find((m) => m.role === "assistant");
  const noProviders = models && !models.chat.some((m) => m.available);
  const autoModel = models?.chat.find((m) => m.id === "auto");

  const updateComposer = (patch: Partial<ComposerSettings>) => {
    const id = chat.conversation?.id ?? null;
    setOverrides((o) => ({ id, v: { ...(o.id === id ? o.v : {}), ...patch } }));
    if (patch.model) update({ model: patch.model });
    if (patch.mode) update({ privacyMode: patch.mode });
    if (patch.reasoning) update({ reasoning: patch.reasoning });
  };

  return (
    <div className="flex h-full flex-col">
      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          setPinned(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
        }}
        className="scrollbar-thin relative min-h-0 flex-1 overflow-y-auto"
      >
        {visible.length === 0 && !chat.loading ? (
          <div className="mx-auto flex h-full max-w-[760px] flex-col justify-center px-5 pb-10">
            {agent ? (
              <div data-testid="agent-intro">
                <AgentAvatar name={agent.name} size={52} />
                <h1 className="display mt-5 text-[40px] sm:text-[52px]">{agent.name}</h1>
                {agent.description ? <p className="mt-2 max-w-[60ch] text-[15px] text-ink-2">{agent.description}</p> : null}
                <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] tracking-[0.06em] text-dim uppercase">
                  <span className="inline-flex items-center gap-1">
                    <ShieldCheck size={12} /> {PRIVACY_MODE_INFO[agent.privacyMode].label} filter
                  </span>
                  {agent.solana ? (
                    <span className="inline-flex items-center gap-1">
                      <Wallet size={12} /> Solana connector
                    </span>
                  ) : null}
                  <Link href="/app/agents" className="normal-case tracking-normal underline-offset-4 hover:text-ink hover:underline">
                    Edit agent
                  </Link>
                </p>
                {agent.starters.length && composer ? (
                  <div className="mt-6 grid gap-2 sm:grid-cols-2">
                    {agent.starters.map((s) => (
                      <button
                        key={s}
                        onClick={() => {
                          setPinned(true);
                          chat.send({
                            text: s,
                            images: [],
                            textFiles: [],
                            attachments: [],
                            model: composer.model,
                            mode: composer.mode,
                            reasoning: composer.reasoning,
                            tools: composer.solana && autoModel?.tools ? ["solana"] : [],
                          });
                        }}
                        disabled={chat.streaming || !autoModel?.available}
                        className="rounded-xl border border-line bg-surface px-4 py-3 text-left text-[14px] text-ink-2 transition-colors hover:border-ink/30 hover:text-ink disabled:opacity-50"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : agentId && agentsReady && !cid ? (
              <div>
                <h1 className="display text-[40px] sm:text-[52px]">Agent not found.</h1>
                <p className="mt-3 text-[14px] text-ink-2">
                  It may have been deleted, or it was made in another browser.{" "}
                  <Link href="/app/agents" className="underline underline-offset-4">
                    Your agents
                  </Link>
                </p>
              </div>
            ) : (
              <>
                <h1 className="display text-[44px] sm:text-[56px]">Build in private.</h1>
                <p className="mt-3 flex items-center gap-1.5 text-[14px] text-ink-2">
                  <Lock size={14} /> Personal details are replaced on this device before anything is sent. History stays in this browser.
                </p>
              </>
            )}
            {noProviders ? (
              <p className="mt-6 rounded-xl border border-line bg-sunken px-4 py-3 text-[13.5px] text-ink-2" role="status">
                Chat is briefly unavailable. Please check back shortly.
              </p>
            ) : null}
            {modelsError ? <p className="mt-6 text-[13.5px] text-danger">{modelsError}</p> : null}
            {!account && cfg.freeDailyMessages > 0 ? (
              <p className="mt-6 text-[12.5px] text-dim">Free: {cfg.freeDailyMessages} messages a day. No account needed.</p>
            ) : null}
          </div>
        ) : (
          <div className="mx-auto max-w-[760px] space-y-8 px-5 pt-8 pb-10">
            {agent ? (
              <Link href="/app/agents" className="mx-auto flex w-fit items-center gap-2 rounded-full border border-line bg-surface py-1 pr-3 pl-1 text-[12.5px] text-ink-2 hover:text-ink" data-testid="agent-chip">
                <AgentAvatar name={agent.name} size={22} className="rounded-full" />
                {agent.name}
              </Link>
            ) : null}
            {visible.map((m) =>
              m.role === "user" ? (
                <UserMessage key={m.id} m={m} />
              ) : (
                <AssistantMessage
                  key={m.id}
                  m={m}
                  streaming={chat.streaming && m.id === lastAssistant?.id}
                  isLast={m.id === lastAssistant?.id}
                  onRegenerate={() => composer && chat.regenerate({ model: composer.model, mode: composer.mode, reasoning: composer.reasoning, tools: composer.solana ? ["solana"] : [] })}
                  onToolUpdate={(callId, patch) => chat.updateToolCall(m.id, callId, patch)}
                />
              ),
            )}
          </div>
        )}
        {!pinned ? (
          <button
            onClick={() => {
              setPinned(true);
              scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
            }}
            className="sticky bottom-3 left-1/2 mx-auto flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border border-line bg-surface shadow-[var(--shadow-pop)]"
            aria-label="Scroll to bottom"
          >
            <ArrowDown size={15} />
          </button>
        ) : null}
      </div>

      <div className="shrink-0 px-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:px-5">
        <div className="mx-auto max-w-[760px]">
          {composer ? (
            <Composer
              autoFocus
              models={models?.chat ?? null}
              settings={composer}
              onSettings={updateComposer}
              onSend={(input) => {
                setPinned(true);
                chat.send(input);
              }}
              onStop={chat.stop}
              streaming={chat.streaming}
            />
          ) : (
            <div className="shimmer h-[104px] rounded-2xl" />
          )}
          <p className="mt-2 text-center text-[11px] text-dim">AI can be wrong. Check anything important. Placeholders and history never leave this browser.</p>
        </div>
      </div>
    </div>
  );
}

