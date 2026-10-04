"use client";

import { AnimatePresence, m, useInView } from "framer-motion";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { Check, Lock } from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Entity = { o: string; p: string };
type Seg = string | Entity;

interface Scenario {
  id: string;
  label: string;
  prompt: Seg[];
  reply: Seg[];
}

const SCENARIOS: Scenario[] = [
  {
    id: "deploy",
    label: "Deploy",
    prompt: ["Ship the API to ", { o: "84.203.17.9", p: "[IP_1]" }, " with key ", { o: "sk-proj-9fQ2Lm…AbCd", p: "[SECRET_1]" }, " and ping ", { o: "Tom", p: "[PERSON_1]" }, " when it's live."],
    reply: ["Deploy script ready. It targets ", { o: "84.203.17.9", p: "[IP_1]" }, ", reads the key from an env var, and messages ", { o: "Tom", p: "[PERSON_1]" }, " after the health check passes."],
  },
  {
    id: "debug",
    label: "Debug",
    prompt: ["Why was ", { o: "daniel@northwind.io", p: "[EMAIL_1]" }, " charged twice? DB is postgres://admin:", { o: "Tr0ub4dor-9x", p: "[SECRET_1]" }, "@db/prod"],
    reply: ["Two webhook retries hit checkout for ", { o: "daniel@northwind.io", p: "[EMAIL_1]" }, ". Here's an idempotency fix and a query to refund the duplicate."],
  },
  {
    id: "wallet",
    label: "Wallet",
    prompt: ["Send 2 SOL to ", { o: "9WzDXw…AWWM", p: "[WALLET_1]" }, " and tell ", { o: "Priya", p: "[PERSON_1]" }, " it's for the ", { o: "New York", p: "[CITY_1]" }, " offsite."],
    reply: ["A 2 SOL transfer to ", { o: "9WzDXw…AWWM", p: "[WALLET_1]" }, " is ready to approve in your wallet. Note for ", { o: "Priya", p: "[PERSON_1]" }, " drafted."],
  },
];

const ROUTES = 5;

const len = (s: Seg) => (typeof s === "string" ? s.length : s.o.length);
const replyLen = (s: Seg) => (typeof s === "string" ? s.length : s.p.length);

/** Start offset of each segment, and the index of each entity among entities. */
function layout(segs: Seg[], size: (s: Seg) => number) {
  const starts: number[] = [];
  const entityIndex: number[] = [];
  let at = 0;
  let e = 0;
  for (const s of segs) {
    starts.push(at);
    entityIndex.push(typeof s === "string" ? -1 : e++);
    at += size(s);
  }
  return { starts, entityIndex, entities: e };
}

/** Every phase is a pure function of time since the scenario started. */
function timeline(sc: Scenario) {
  const promptChars = sc.prompt.reduce((n, s) => n + len(s), 0);
  const replyChars = sc.reply.reduce((n, s) => n + replyLen(s), 0);
  const typeEnd = Math.min(2200, promptChars * 26);
  const sweepStart = typeEnd + 350;
  const sweepEnd = sweepStart + 1500;
  const sendEnd = sweepEnd + 700;
  const replyEnd = sendEnd + Math.min(2200, replyChars * 20);
  const restoreStart = replyEnd + 450;
  const restoreEnd = restoreStart + 700;
  const total = restoreEnd + 2600;
  return { promptChars, replyChars, typeEnd, sweepStart, sweepEnd, sendEnd, replyEnd, restoreStart, restoreEnd, total };
}

const STEPS = [
  { label: "You paste", short: "Paste" },
  { label: "Veil swaps", short: "Veil" },
  { label: "Auto answers", short: "Auto" },
  { label: "Restored here", short: "Local" },
];

export function VeilScan() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-80px" });
  const reduce = useReducedMotion();
  const [idx, setIdx] = useState(0);
  const [t, setT] = useState(0);
  const sc = SCENARIOS[idx];
  const tl = timeline(sc);
  const now = reduce ? tl.total - 1 : t;

  useEffect(() => {
    if (!inView || reduce) return;
    let raf = 0;
    const start = performance.now() - t;
    const total = timeline(SCENARIOS[idx]).total;
    const tick = (ts: number) => {
      const el = ts - start;
      if (el >= total) {
        setIdx((i) => (i + 1) % SCENARIOS.length);
        setT(0);
        return;
      }
      setT(el);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // `t` is only read to resume where we paused; restarting on every tick would be wrong.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, reduce, idx]);

  const typed = Math.floor((Math.min(now, tl.typeEnd) / tl.typeEnd) * tl.promptChars);
  const sweep = Math.min(1, Math.max(0, (now - tl.sweepStart) / (tl.sweepEnd - tl.sweepStart)));
  const sending = now >= tl.sweepEnd;
  const replyTyped = now < tl.sendEnd ? 0 : Math.floor((Math.min(now, tl.replyEnd) - tl.sendEnd) / (tl.replyEnd - tl.sendEnd) * tl.replyChars);
  const restoredFrac = Math.min(1, Math.max(0, (now - tl.restoreStart) / (tl.restoreEnd - tl.restoreStart)));
  const step = now < tl.sweepStart ? 0 : now < tl.sweepEnd ? 1 : now < tl.restoreStart ? 2 : 3;
  const route = (idx * 2 + 1) % ROUTES;

  // Prompt: typed out, then each detail is swapped as the veil passes its position in the text.
  const pl = layout(sc.prompt, len);
  const promptNodes = sc.prompt.map((s, i) => {
    const start = pl.starts[i];
    const visible = Math.max(0, Math.min(len(s), typed - start));
    if (typeof s === "string") return <Fragment key={i}>{s.slice(0, visible)}</Fragment>;
    const swapped = sweep > 0 && sweep >= (start + len(s) / 2) / tl.promptChars;
    if (visible < len(s)) return <Fragment key={i}>{s.o.slice(0, visible)}</Fragment>;
    return (
      <AnimatePresence key={i} mode="popLayout" initial={false}>
        {swapped ? (
          <m.span key="p" className="chip-ph" initial={{ opacity: 0, filter: "blur(6px)", scale: 0.9 }} animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }} transition={{ duration: 0.35 }}>
            {s.p}
          </m.span>
        ) : (
          <m.mark key="o" className="chip-orig" exit={{ opacity: 0, filter: "blur(6px)" }} transition={{ duration: 0.2 }}>
            {s.o}
          </m.mark>
        )}
      </AnimatePresence>
    );
  });

  // Reply: streamed in placeholders, then real values come back one by one.
  const rl = layout(sc.reply, replyLen);
  const replyNodes = sc.reply.map((s, i) => {
    const start = rl.starts[i];
    const visible = Math.max(0, Math.min(replyLen(s), replyTyped - start));
    if (typeof s === "string") return <Fragment key={i}>{s.slice(0, visible)}</Fragment>;
    const k = rl.entityIndex[i];
    if (visible < replyLen(s)) return visible > 0 ? <span key={i} className="chip-ph opacity-60">{s.p.slice(0, visible)}</span> : null;
    const restored = restoredFrac > 0 && restoredFrac >= (k + 0.5) / rl.entities;
    return (
      <AnimatePresence key={i} mode="popLayout" initial={false}>
        {restored ? (
          <m.mark key="o" className="chip-orig" initial={{ opacity: 0, filter: "blur(6px)" }} animate={{ opacity: 1, filter: "blur(0px)" }} transition={{ duration: 0.35 }}>
            {s.o}
          </m.mark>
        ) : (
          <m.span key="p" className="chip-ph" exit={{ opacity: 0, filter: "blur(6px)" }} transition={{ duration: 0.2 }}>
            {s.p}
          </m.span>
        )}
      </AnimatePresence>
    );
  });

  return (
    <div ref={ref} className="card overflow-hidden">
      {/* Steps */}
      <div className="grid grid-cols-4 border-b border-line-2">
        {STEPS.map(({ label, short }, i) => (
          <div key={label} className={cn("relative px-3 py-3 font-mono text-[10.5px] tracking-[0.08em] uppercase transition-colors sm:px-4 sm:text-[11px]", i <= step ? "text-ink" : "text-dim")}>
            <span className="text-dim">0{i + 1}</span> <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{short}</span>
            <span className={cn("absolute inset-x-0 bottom-[-1px] h-[2px] origin-left bg-accent transition-transform duration-500", i === step ? "scale-x-100" : "scale-x-0")} />
          </div>
        ))}
      </div>

      <div className="space-y-4 p-4 sm:p-6">
        {/* Prompt with the veil sweeping over it */}
        <div className="relative overflow-hidden rounded-xl border border-line bg-bg px-4 py-4">
          <div className="mb-2 flex items-center justify-between font-mono text-[10.5px] tracking-[0.12em] text-dim uppercase">
            <span>Your prompt</span>
            <span className="inline-flex items-center gap-1.5 text-mint">
              <Lock size={11} /> On device
            </span>
          </div>
          <p className="min-h-[72px] text-[15px] leading-[1.75] text-ink [overflow-wrap:anywhere] sm:min-h-[56px]">
            {promptNodes}
            {now < tl.typeEnd ? <span className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[3px] animate-pulse bg-ink" /> : null}
          </p>
          {sweep > 0 && sweep < 1 ? (
            <>
              <div className="pointer-events-none absolute inset-x-0 top-0 bg-accent/[0.06]" style={{ height: `${sweep * 100}%` }} />
              <div className="pointer-events-none absolute inset-x-0 h-[2px] bg-accent shadow-[0_0_18px_4px_var(--accent)]" style={{ top: `${sweep * 100}%` }} />
            </>
          ) : null}
        </div>

        {/* Route: Auto picks one of several unnamed lanes */}
        <div className="flex items-center gap-3 px-1">
          <span className={cn("rounded-full border px-2.5 py-1 font-mono text-[11px] tracking-[0.08em] transition-colors", sending ? "border-accent-line bg-accent-soft text-accent-ink" : "border-line text-dim")}>AUTO</span>
          <div className="flex flex-1 items-center gap-1.5">
            {Array.from({ length: ROUTES }, (_, i) => (
              <span
                key={i}
                className={cn(
                  "h-[3px] flex-1 rounded-full transition-all duration-500",
                  sending && i === route ? "bg-accent shadow-[0_0_10px_var(--accent)]" : "bg-line",
                )}
              />
            ))}
          </div>
          <span className="font-mono text-[10.5px] tracking-[0.1em] text-dim uppercase">{sending ? "Placeholders only" : "Waiting"}</span>
        </div>

        {/* Reply */}
        <div className="rounded-xl border border-line bg-bg px-4 py-4">
          <div className="mb-2 flex items-center justify-between font-mono text-[10.5px] tracking-[0.12em] text-dim uppercase">
            <span>Answer</span>
            {restoredFrac >= 1 ? (
              <span className="inline-flex items-center gap-1.5 text-mint">
                <Check size={11} /> Restored on this device
              </span>
            ) : null}
          </div>
          <p className="min-h-[72px] text-[15px] leading-[1.75] text-ink-2 [overflow-wrap:anywhere] sm:min-h-[56px]">{replyNodes}</p>
        </div>

        {/* Scenario switcher */}
        <div className="flex items-center gap-1.5 pt-1">
          {SCENARIOS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => {
                setIdx(i);
                setT(0);
              }}
              className={cn("rounded-full px-3 py-1 text-[12.5px] transition-colors", i === idx ? "bg-ink text-bg" : "text-ink-2 hover:bg-ink/5")}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
