"use client";

import { ArrowDown, Lock } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAccount } from "@/components/app/account-provider";
import { useModels } from "@/components/app/use-models";
import { useConfig } from "@/components/providers/config-provider";
import { useSettings } from "@/lib/storage/hooks";
import { AssistantMessage, UserMessage } from "./message";
import { Composer, type ComposerSettings } from "./composer";
import { useChat } from "./use-chat";

const SUGGESTIONS = [
  "Plan a quiet weekend in Galway for two, under €400.",
  "What's in my wallet? Show my largest tokens.",
  "Explain my last Solana transaction.",
  "Rewrite this email so it sounds firmer but polite.",
];

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
  const [prefill, setPrefill] = useState<string | null>(null);

  const onCreated = useCallback(
    (id: string) => {
      // Keep toggles chosen before the first message (e.g. Solana tools) for the new conversation.
      setOverrides((o) => (o.id === null ? { id, v: o.v } : o));
      router.replace(`/app?c=${id}`, { scroll: false });
    },
    [router],
  );
  const chat = useChat(cid, onCreated);

  const composer = useMemo<ComposerSettings | null>(() => {
    if (!ready) return null;
    const conv = chat.conversation;
    const own = overrides.id === (conv?.id ?? null) ? overrides.v : {};
    const c: ComposerSettings = {
      model: settings.model,
      mode: settings.privacyMode,
      reasoning: settings.reasoning,
      solana: false,
      ...(conv ? { model: conv.model, mode: conv.privacyMode } : {}),
      ...own,
    };
    // If the chosen model isn't available on this deployment, fall back to Auto.
    const m = models?.chat.find((x) => x.id === c.model);
    if (models && c.model !== "auto" && (!m || !m.available)) c.model = "auto";
    return c;
  }, [ready, settings, chat.conversation, overrides, models]);

  const scroller = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(true);
  useEffect(() => {
    const el = scroller.current;
    if (el && pinned) el.scrollTop = el.scrollHeight;
  }, [chat.messages, pinned]);

  const visible = chat.messages.filter((m) => m.role !== "tool");
  const lastAssistant = [...visible].reverse().find((m) => m.role === "assistant");
  const hasCredits = (account?.balance ?? 0) > 0;
  const noProviders = models && !models.chat.some((m) => m.available);

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
            <h1 className="display text-[44px] sm:text-[56px]">What&apos;s on your mind?</h1>
            <p className="mt-3 flex items-center gap-1.5 text-[14px] text-ink-2">
              <Lock size={14} /> Personal details are replaced on this device before anything is sent. History stays in this browser.
            </p>
            {noProviders ? (
              <p className="mt-6 rounded-xl border border-amber/30 bg-amber-soft px-4 py-3 text-[13.5px] text-ink-2" role="status">
                No model providers are configured on this deployment yet. Add a provider key (e.g. ANTHROPIC_API_KEY) to the server environment to enable chat.
              </p>
            ) : null}
            {modelsError ? <p className="mt-6 text-[13.5px] text-danger">{modelsError}</p> : null}
            <div className="mt-8 grid gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setPrefill(s);
                    if (/wallet|transaction/i.test(s)) updateComposer({ solana: true });
                  }}
                  className="rounded-xl border border-line bg-surface px-4 py-3 text-left text-[13.5px] text-ink-2 transition-colors hover:border-ink/30 hover:text-ink"
                >
                  {s}
                </button>
              ))}
            </div>
            {!account && cfg.freeDailyMessages > 0 ? (
              <p className="mt-6 text-[12.5px] text-dim">Free tier: {cfg.freeDailyMessages} messages a day on models marked free. No account needed.</p>
            ) : null}
          </div>
        ) : (
          <div className="mx-auto max-w-[760px] space-y-8 px-5 pt-8 pb-10">
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
            <ComposerWithPrefill
              key={prefill ?? "c"}
              prefill={prefill}
              models={models?.chat ?? null}
              settings={composer}
              onSettings={updateComposer}
              onSend={(input) => {
                setPinned(true);
                setPrefill(null);
                chat.send(input);
              }}
              onStop={chat.stop}
              streaming={chat.streaming}
              hasCredits={hasCredits}
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

function ComposerWithPrefill({ prefill, ...props }: React.ComponentProps<typeof Composer> & { prefill: string | null }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!prefill) return;
    const ta = ref.current?.querySelector("textarea");
    if (ta) {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
      setter?.call(ta, prefill);
      ta.dispatchEvent(new Event("input", { bubbles: true }));
      ta.focus();
    }
  }, [prefill]);
  return (
    <div ref={ref}>
      <Composer {...props} autoFocus />
    </div>
  );
}
