"use client";

import { AlertTriangle, Ban, Brain, Check, ChevronRight, FileText, Loader2, RotateCcw, Wrench } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PrivacyReceipt } from "@/components/privacy/receipt";
import type { StoredMessage, StoredToolCall } from "@/lib/storage/db";
import { cn } from "@/lib/utils";
import { CopyButton, Markdown } from "./markdown";
import { TransferCard } from "./transfer-card";

function ToolChip({ call }: { call: StoredToolCall }) {
  const icon =
    call.status === "running" ? <Loader2 size={12} className="animate-spin" /> : call.status === "error" ? <AlertTriangle size={12} className="text-danger" /> : call.status === "blocked" ? <Ban size={12} /> : <Check size={12} className="text-mint" />;
  return (
    <div className="flex items-center gap-2 font-mono text-[11.5px] text-ink-2">
      {icon}
      <span>{call.name}</span>
      <span className="truncate text-dim">· {call.error ?? call.summary ?? call.status.replace("_", " ")}</span>
    </div>
  );
}

export function UserMessage({ m }: { m: StoredMessage }) {
  return (
    <div className="flex flex-col items-end" data-testid="user-message">
      {m.attachments?.length ? (
        <div className="mb-2 flex flex-wrap justify-end gap-2">
          {m.attachments.map((a, i) =>
            a.dataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={a.dataUrl} alt={a.name} className="h-24 w-24 rounded-xl border border-line object-cover" />
            ) : (
              <span key={i} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-[12.5px]">
                <FileText size={13} /> {a.name}
              </span>
            ),
          )}
        </div>
      ) : null}
      {m.content ? <div className="max-w-[88%] rounded-2xl rounded-br-md bg-sunken px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap">{m.content}</div> : null}
      {m.receipt ? <PrivacyReceipt receipt={m.receipt} /> : null}
    </div>
  );
}

export function AssistantMessage({
  m,
  streaming,
  isLast,
  onRegenerate,
  onToolUpdate,
}: {
  m: StoredMessage;
  streaming: boolean;
  isLast: boolean;
  onRegenerate: () => void;
  onToolUpdate: (callId: string, patch: Partial<StoredToolCall>) => void;
}) {
  const [showReasoning, setShowReasoning] = useState(false);
  const empty = !m.content && !m.error && !m.toolCalls?.length;
  const insufficient = m.error && /credits|free messages/i.test(m.error);

  return (
    <div className="group" data-testid="assistant-message">
      <div className="mb-1.5 flex items-center gap-2 font-mono text-[11px] text-dim">
        <span>{m.modelLabel ?? "…"}</span>
        {m.billing === "free" ? <span className="rounded border border-line px-1 text-[10px] uppercase">free</span> : null}
      </div>
      {m.reasoning ? (
        <div className="mb-2">
          <button onClick={() => setShowReasoning((v) => !v)} className="inline-flex items-center gap-1 text-[12.5px] text-dim hover:text-ink">
            <Brain size={13} /> {streaming && !m.content ? "Thinking…" : "Reasoning summary"}
            <ChevronRight size={13} className={cn("transition-transform", showReasoning && "rotate-90")} />
          </button>
          {showReasoning ? <div className="mt-2 border-l-2 border-line pl-3 text-[13px] leading-relaxed whitespace-pre-wrap text-ink-2">{m.reasoning}</div> : null}
        </div>
      ) : null}

      {empty && streaming ? (
        <div className="flex gap-1 py-2" aria-label="Generating">
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-1.5 w-1.5 animate-pulse rounded-full bg-dim" style={{ animationDelay: `${i * 150}ms` }} />
          ))}
        </div>
      ) : null}

      {m.content ? (
        <div className={cn(streaming && "is-streaming")}>
          <Markdown text={m.content} />
        </div>
      ) : null}

      {m.toolCalls?.length ? (
        <div className="mt-3 space-y-1.5 rounded-xl border border-line-2 bg-sunken/60 px-3 py-2.5">
          <div className="eyebrow flex items-center gap-1.5">
            <Wrench size={11} /> Solana connector · ran in this browser
          </div>
          {m.toolCalls.map((c) => (
            <div key={c.id}>
              <ToolChip call={c} />
              {c.preview ? <TransferCard call={c} onUpdate={(patch) => onToolUpdate(c.id, patch)} /> : null}
            </div>
          ))}
        </div>
      ) : null}

      {m.error ? (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-danger/20 bg-danger-soft px-3.5 py-2.5 text-[13.5px] text-danger" role="alert">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span>
            {m.error}
            {insufficient ? (
              <>
                {" "}
                <Link href="/app/credits" className="font-medium underline">
                  Get credits
                </Link>
              </>
            ) : null}
          </span>
        </div>
      ) : null}
      {m.stopReason === "refusal" ? <p className="mt-2 text-[12.5px] text-dim">The model declined to answer this request.</p> : null}
      {m.stopReason === "max_tokens" ? <p className="mt-2 text-[12.5px] text-dim">The reply hit its length limit.</p> : null}
      {m.stopReason === "aborted" ? <p className="mt-2 text-[12.5px] text-dim">Stopped.</p> : null}

      {!streaming && (m.content || m.error) ? (
        <div className="mt-2 flex items-center gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100">
          {m.content ? <CopyButton text={m.content} /> : null}
          {isLast ? (
            <button onClick={onRegenerate} className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[12px] text-dim hover:text-ink" data-testid="regenerate">
              <RotateCcw size={13} /> Regenerate
            </button>
          ) : null}
          {m.usage ? (
            <span className="ml-2 font-mono text-[11px] text-dim">
              {m.usage.inputTokens + m.usage.outputTokens} tokens{m.usage.credits ? ` · ${m.usage.credits} credits` : ""}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
