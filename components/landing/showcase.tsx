"use client";

import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, ChevronDown, Code2, Film, ImageIcon, MessageSquare, Plug, Shield, Wallet } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { WithPlaceholders } from "@/components/privacy/highlight";
import { cn } from "@/lib/utils";

type TabId = "chat" | "image" | "video" | "connect" | "code";

const TABS: Array<{ id: TabId; label: string; icon: typeof MessageSquare; title: string; body: string; points: string[]; href: string; cta: string }> = [
  {
    id: "chat",
    label: "Chat",
    icon: MessageSquare,
    title: "A composer that knows what it's sending.",
    body: "Switch models mid-conversation, set reasoning depth, attach files, and see a receipt for every message showing exactly what left your device.",
    points: ["Streaming with stop and regenerate", "Markdown, tables and highlighted code", "Per-message privacy receipts", "Text and image attachments"],
    href: "/app",
    cta: "Open chat",
  },
  {
    id: "image",
    label: "Image",
    icon: ImageIcon,
    title: "Images that live in your browser.",
    body: "Prompt, choose a model, aspect ratio and quality. Results are saved to this device's storage — not to a gallery on our servers.",
    points: ["Multiple image providers", "Aspect ratio and quality controls", "Local history you can export or wipe"],
    href: "/app/image",
    cta: "Open image studio",
  },
  {
    id: "video",
    label: "Video",
    icon: Film,
    title: "Short clips from a sentence or a still.",
    body: "Text-to-video and image-to-video with duration and resolution settings. Credits are refunded automatically if a generation fails.",
    points: ["Text → video and image → video", "Live progress while it renders", "Automatic refunds on failed jobs"],
    href: "/app/video",
    cta: "Open video studio",
  },
  {
    id: "connect",
    label: "Connect",
    icon: Plug,
    title: "A Solana connector that can't spend.",
    body: "Ask about balances, tokens and recent transactions. Reads run in your browser. Anything that moves funds becomes a preview you approve in your own wallet.",
    points: ["SOL and SPL balances, history, token info", "Transfers prepared, never sent by the AI", "Your address reaches the model only as a placeholder"],
    href: "/app",
    cta: "Try the connector",
  },
  {
    id: "code",
    label: "Code",
    icon: Code2,
    title: "Describe it. Watch it run.",
    body: "A coding agent that writes small web projects, shows every file, and runs them in a locked-down preview — no network, no access to your session.",
    points: ["File tree and full file contents", "Sandboxed live preview", "Iterate in plain language"],
    href: "/app/code",
    cta: "Open code agent",
  },
];

function Frame({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("card overflow-hidden shadow-[var(--shadow-pop)]", className)}>
      <div className="flex items-center gap-2 border-b border-line bg-sunken px-4 py-2.5">
        <span className="flex gap-1.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-faint" />
          <span className="h-2.5 w-2.5 rounded-full bg-faint" />
          <span className="h-2.5 w-2.5 rounded-full bg-faint" />
        </span>
        <span className="ml-2 font-mono text-[11px] text-dim">{title}</span>
        <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-dim">Interface preview</span>
      </div>
      {children}
    </div>
  );
}

function Pill({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return (
    <span className={cn("inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[12px]", active ? "border-accent-line bg-accent-soft text-accent-ink" : "border-line bg-surface text-ink-2")}>
      {children}
    </span>
  );
}

function useTyped(text: string) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setN((v) => (v >= text.length ? v : v + 3)), 28);
    return () => clearInterval(t);
  }, [text, reduce]);
  return reduce ? text : text.slice(0, n);
}

function ChatPreview() {
  const answer = "Here's a 3-day plan for [CITY_1]. Day one: the old town and a slow lunch; day two: the coast by train; day three: museums, then dinner near [ADDRESS_1].";
  const typed = useTyped(answer);
  return (
    <Frame title="tacit / chat">
      <div className="space-y-4 p-4 sm:p-5">
        <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-sunken px-4 py-3 text-[13.5px]">
          Plan three days in Lisbon for me — we&apos;re staying at 12 Rua da Rosa.
          <div className="mt-2 flex items-center gap-1.5 font-mono text-[10.5px] text-mint">
            <Shield size={11} /> 2 replaced before sending
          </div>
        </div>
        <div className="max-w-[92%] text-[13.5px] leading-relaxed">
          <WithPlaceholders text={typed} />
          <span className="caret" />
        </div>
        <div className="rounded-xl border border-line bg-surface p-3">
          <div className="h-5 text-[13px] text-dim">Ask anything…</div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Pill>
              Auto <ChevronDown size={12} />
            </Pill>
            <Pill>Reasoning · Medium</Pill>
            <Pill active>
              <Shield size={11} /> Smart
            </Pill>
            <Pill>
              <Wallet size={11} /> Solana
            </Pill>
          </div>
        </div>
      </div>
    </Frame>
  );
}

const ART = [
  ["#5546e8", "#12876b"],
  ["#e8a046", "#c53a2f"],
  ["#101113", "#8d82ff"],
  ["#12876b", "#f2f2ec"],
];

function ImagePreview() {
  return (
    <Frame title="tacit / image">
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Pill>FLUX 1.1 Pro</Pill>
          <Pill>3:2</Pill>
          <Pill>High</Pill>
        </div>
        <div className="mt-3 rounded-xl border border-line bg-surface px-3 py-2.5 text-[13px] text-ink-2">
          a quiet harbour at dawn, risograph print, two colours
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {ART.map(([a, b], i) => (
            <svg key={i} viewBox="0 0 150 100" className="aspect-[3/2] w-full rounded-lg" aria-hidden>
              <defs>
                <linearGradient id={`g${i}`} x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0" stopColor={a} />
                  <stop offset="1" stopColor={b} />
                </linearGradient>
              </defs>
              <rect width="150" height="100" fill={`url(#g${i})`} />
              <circle cx={40 + i * 22} cy={42} r={18 + i * 3} fill="white" opacity="0.18" />
              <path d={`M0 ${70 - i * 4} Q 40 ${58 + i * 3} 75 ${68 - i * 2} T 150 ${64 + i}`} stroke="white" strokeOpacity="0.5" fill="none" strokeWidth="1.5" />
              <rect y="78" width="150" height="22" fill="black" opacity="0.12" />
            </svg>
          ))}
        </div>
        <p className="mt-3 font-mono text-[10.5px] uppercase tracking-wider text-dim">Abstract placeholders · saved in this browser</p>
      </div>
    </Frame>
  );
}

function VideoPreview() {
  const reduce = useReducedMotion();
  return (
    <Frame title="tacit / video">
      <div className="p-4 sm:p-5">
        <div className="relative aspect-video overflow-hidden rounded-xl bg-panel">
          <m.div
            aria-hidden
            className="absolute -inset-1/2 opacity-80"
            style={{ background: "radial-gradient(circle at 30% 40%, #5546e8 0, transparent 35%), radial-gradient(circle at 70% 60%, #12876b 0, transparent 30%)" }}
            animate={reduce ? undefined : { rotate: 360 }}
            transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
          />
          <div className="absolute inset-x-4 bottom-4">
            <div className="flex items-center justify-between font-mono text-[10.5px] text-panel-ink/80">
              <span>Generating</span>
              <span>62%</span>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/15">
              <m.div className="h-full bg-white" initial={{ width: "20%" }} animate={{ width: "62%" }} transition={{ duration: 2.4, ease: "easeOut" }} />
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          <Pill active>Text → Video</Pill>
          <Pill>Image → Video</Pill>
          <Pill>6s</Pill>
          <Pill>768p</Pill>
        </div>
      </div>
    </Frame>
  );
}

function ConnectPreview() {
  return (
    <Frame title="tacit / connector">
      <div className="space-y-3 p-4 text-[13px] sm:p-5">
        <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-sunken px-4 py-2.5">Send 0.1 SOL to my brother&apos;s wallet and show my largest tokens.</div>
        <div className="space-y-1.5 font-mono text-[11.5px]">
          <div className="flex items-center gap-2 text-ink-2">
            <Check size={12} className="text-mint" /> solana_token_balances <span className="text-dim">· read · ran in browser</span>
          </div>
          <div className="flex items-center gap-2 text-ink-2">
            <span className="dot bg-amber" /> solana_prepare_sol_transfer <span className="text-dim">· write · needs you</span>
          </div>
        </div>
        <div className="rounded-xl border border-ink/25 bg-surface p-3.5">
          <div className="flex items-center justify-between">
            <span className="font-medium">Transfer preview</span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-amber">Awaiting approval</span>
          </div>
          <dl className="mt-2.5 grid grid-cols-[80px_1fr] gap-y-1 text-[12.5px]">
            <dt className="text-dim">Amount</dt>
            <dd>0.1 SOL</dd>
            <dt className="text-dim">To</dt>
            <dd className="font-mono">7xKX…sAsU</dd>
            <dt className="text-dim">Network fee</dt>
            <dd>≈ 0.000005 SOL</dd>
          </dl>
          <div className="mt-3 flex gap-2">
            <span className="inline-flex h-8 items-center rounded-lg bg-ink px-3 text-[12.5px] text-bg">Review in wallet</span>
            <span className="inline-flex h-8 items-center rounded-lg border border-line px-3 text-[12.5px]">Cancel</span>
          </div>
        </div>
      </div>
    </Frame>
  );
}

function CodePreview() {
  return (
    <Frame title="tacit / code">
      <div className="grid grid-cols-[110px_1fr] text-[12px] sm:grid-cols-[130px_1fr]">
        <ul className="space-y-1 border-r border-line bg-sunken p-3 font-mono text-[11.5px] text-ink-2">
          <li className="text-ink">▾ project</li>
          <li className="pl-3 text-ink">index.html</li>
          <li className="pl-3">style.css</li>
          <li className="pl-3">app.js</li>
        </ul>
        <div>
          <pre className="overflow-x-auto bg-panel p-3 font-mono text-[11.5px] leading-relaxed text-panel-ink">
            <code>
              <span className="text-[#b5aaff]">const</span> board = <span className="text-[#8fc1ff]">createBoard</span>(
              <span className="text-[#f2c27b]">8</span>);{"\n"}board.<span className="text-[#8fc1ff]">on</span>(
              <span className="text-[#8ed8b6]">&quot;move&quot;</span>, render);{"\n"}
              <span className="text-[#7d8487]">{"// tap a square to play"}</span>
            </code>
          </pre>
          <div className="border-t border-line p-3 font-mono text-[11px] text-ink-2">
            <div>
              <span className="text-mint">✓</span> wrote index.html, style.css, app.js
            </div>
            <div>
              <span className="text-mint">✓</span> preview ready · sandboxed
            </div>
          </div>
          <div className="m-3 mt-0 grid aspect-[2/1] grid-cols-8 overflow-hidden rounded-lg border border-line">
            {Array.from({ length: 32 }).map((_, i) => (
              <span key={i} className={(i + Math.floor(i / 8)) % 2 ? "bg-ink/80" : "bg-surface"} />
            ))}
          </div>
        </div>
      </div>
    </Frame>
  );
}

const PREVIEWS: Record<TabId, () => React.ReactElement> = {
  chat: ChatPreview,
  image: ImagePreview,
  video: VideoPreview,
  connect: ConnectPreview,
  code: CodePreview,
};

export function Showcase() {
  const [tab, setTab] = useState<TabId>("chat");
  const active = TABS.find((t) => t.id === tab)!;
  const Preview = PREVIEWS[tab];

  const onKey = (e: React.KeyboardEvent) => {
    const i = TABS.findIndex((t) => t.id === tab);
    if (e.key === "ArrowRight") setTab(TABS[(i + 1) % TABS.length].id);
    if (e.key === "ArrowLeft") setTab(TABS[(i - 1 + TABS.length) % TABS.length].id);
  };

  return (
    <div>
      <div role="tablist" aria-label="Products" onKeyDown={onKey} className="no-scrollbar -mx-5 flex gap-1 overflow-x-auto border-b border-line px-5 sm:mx-0 sm:px-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => setTab(t.id)}
            className={cn(
              "relative flex h-11 shrink-0 items-center gap-2 px-4 font-mono text-[12px] uppercase tracking-[0.08em] transition-colors",
              tab === t.id ? "text-ink" : "text-dim hover:text-ink-2",
            )}
          >
            <t.icon size={14} />
            {t.label}
            {tab === t.id ? <m.span layoutId="tab-underline" className="absolute inset-x-3 -bottom-px h-[2px] bg-ink" /> : null}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="mt-10 grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14">
        <AnimatePresence mode="wait">
          <m.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3 }}>
            <h3 className="font-serif text-[34px] leading-[1.05] tracking-[-0.01em] sm:text-[40px]">{active.title}</h3>
            <p className="mt-4 text-[15.5px] leading-relaxed text-ink-2">{active.body}</p>
            <ul className="mt-6 space-y-2.5">
              {active.points.map((p) => (
                <li key={p} className="flex items-start gap-2.5 text-[14px]">
                  <Check size={15} className="mt-0.5 shrink-0 text-mint" /> {p}
                </li>
              ))}
            </ul>
            <Link href={active.href} className="group mt-8 inline-flex items-center gap-1.5 text-[14px] font-medium">
              {active.cta} <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          </m.div>
        </AnimatePresence>
        <AnimatePresence mode="wait">
          <m.div
            key={tab}
            aria-hidden
            inert
            initial={{ opacity: 0, scale: 0.985 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-none select-none"
          >
            <Preview />
          </m.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
