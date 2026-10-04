import {
  ArrowRight,
  BookOpen,
  Bot,
  Building2,
  Check,
  Coins,
  Database,
  FileCode2,
  FolderTree,
  HardDrive,
  Image as ImageIcon,
  Lock,
  MessageSquare,
  Minus,
  PenTool,
  Plus,
  Search,
  Server,
  Settings,
  Shield,
  Sparkles,
  Terminal,
  Wallet,
  X,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Logo, LogoMark } from "@/components/ui/logo";
import { Reveal } from "@/components/ui/reveal";
import { Section, SectionHeader } from "@/components/ui/section";
import { getPublicConfig } from "@/server/public-config";

/* ------------------------------------------------------------------ */
export function Solutions() {
  const items = [
    { icon: MessageSquare, title: "Everyday private AI", body: "Health questions, money, relationships, work drafts — the things you'd rather not attach your name to.", tags: ["Smart filter", "Local history"] },
    { icon: Bot, title: "Developers & agents", body: "An OpenAI-compatible endpoint with optional server-side filtering, metered in the same credits as the app.", tags: ["API keys", "Streaming"] },
    { icon: Wallet, title: "Solana users", body: "Ask about balances and transactions without pasting your address into a chatbot. Transfers stay in your wallet's hands.", tags: ["Connector", "Wallet-signed"] },
    { icon: PenTool, title: "Creators", body: "Images and short video from one place, with results saved to your device instead of a public gallery.", tags: ["Image", "Video"] },
    { icon: Search, title: "Research & analysis", body: "Compare answers across model families on the same filtered prompt. Attach notes and data files.", tags: ["Model switching", "Attachments"] },
    { icon: Building2, title: "Teams", body: "Shared credit pools and admin controls are on the roadmap. Today, each person keeps their own account and history.", tags: ["Coming soon"] },
  ];
  return (
    <Section id="solutions">
      <SectionHeader index="04" eyebrow="Solutions" title="For the questions you'd rather keep to yourself." />
      <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it, i) => (
          <Reveal key={it.title} delay={i * 0.04} className="bg-surface p-6 sm:p-7">
            <it.icon size={20} strokeWidth={1.6} className="text-ink" />
            <h3 className="mt-5 text-[17px] font-semibold tracking-[-0.01em]">{it.title}</h3>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{it.body}</p>
            <div className="mt-5 flex flex-wrap gap-1.5">
              {it.tags.map((t) => (
                <Badge key={t} tone={t === "Coming soon" ? "amber" : "neutral"}>
                  {t}
                </Badge>
              ))}
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
export function AppSection() {
  const { appName } = getPublicConfig();
  const callouts = [
    { icon: HardDrive, title: "History in IndexedDB", body: "Conversations, images and projects are stored in this browser. Export or wipe them any time." },
    { icon: Shield, title: "Receipts on every message", body: "Open any message to compare what you wrote with what the model received." },
    { icon: Sparkles, title: "Models side by side", body: "Change model, reasoning level or privacy mode without starting over." },
    { icon: Wallet, title: "Wallet only when it matters", body: "Free chat needs nothing. Connect a wallet to pay, verify token holdings or use the connector." },
  ];
  return (
    <Section id="app">
      <SectionHeader
        index="05"
        eyebrow="The app"
        title="Quiet by default."
        lead="No feed, no ads, no profile. A sidebar of your own conversations, a composer, and the controls you actually use."
      />
      <Reveal delay={0.05} className="mt-14">
        <div aria-hidden inert className="card pointer-events-none overflow-hidden shadow-[var(--shadow-pop)] select-none">
          <div className="grid min-h-[420px] grid-cols-1 md:grid-cols-[230px_1fr]">
            <aside className="hidden flex-col border-r border-line bg-sunken p-3 md:flex">
              <Logo name={appName} className="px-2 py-1.5" />
              <span className="mt-4 flex h-9 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-[13px]">
                <Plus size={14} /> New chat
              </span>
              <p className="eyebrow mt-5 px-2">This device</p>
              {["New York itinerary", "Lease reminder", "Asthma questions", "Token taxes 2025", "Landing page copy"].map((t, i) => (
                <span key={t} className={`mt-1 truncate rounded-md px-2 py-1.5 text-[13px] ${i === 0 ? "bg-surface text-ink" : "text-ink-2"}`}>
                  {t}
                </span>
              ))}
              <div className="mt-auto space-y-1 pt-4 text-[13px] text-ink-2">
                {[
                  [ImageIcon, "Image"],
                  [FileCode2, "Code"],
                  [Coins, "Credits"],
                  [Settings, "Settings"],
                ].map(([I, l]) => {
                  const Icon = I as typeof ImageIcon;
                  return (
                    <span key={l as string} className="flex items-center gap-2 px-2 py-1">
                      <Icon size={14} /> {l as string}
                    </span>
                  );
                })}
              </div>
            </aside>
            <div className="flex flex-col p-5 md:p-8">
              <div className="ml-auto max-w-md rounded-2xl rounded-br-md bg-sunken px-4 py-3 text-[14px]">
                Explain the tax treatment of selling tokens I bought in March, I live in Cork.
              </div>
              <div className="mt-6 max-w-xl space-y-3 text-[14px] leading-relaxed">
                <p>
                  In <span className="chip-ph">[CITY_1]</span> — that is, in Ireland — gains on crypto disposals are generally subject to Capital Gains Tax.
                  A few things decide what you owe:
                </p>
                <ul className="list-disc space-y-1 pl-5 text-ink-2">
                  <li>Your acquisition cost and the sale price in euro</li>
                  <li>The annual personal exemption</li>
                  <li>Which payment window the sale falls in</li>
                </ul>
              </div>
              <div className="mt-auto rounded-xl border border-line bg-surface p-3 pt-3">
                <div className="text-[13px] text-dim">Reply…</div>
                <div className="mt-3 flex items-center gap-1.5 text-[12px]">
                  <span className="rounded-full border border-line px-2.5 py-1">Auto</span>
                  <span className="rounded-full border border-accent-line bg-accent-soft px-2.5 py-1 text-accent-ink">Smart</span>
                  <span className="ml-auto grid h-8 w-8 place-items-center rounded-lg bg-ink text-bg">
                    <ArrowRight size={14} />
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Reveal>
      <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {callouts.map((c, i) => (
          <Reveal key={c.title} delay={i * 0.05}>
            <c.icon size={18} strokeWidth={1.6} />
            <h3 className="mt-3 text-[15px] font-semibold">{c.title}</h3>
            <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">{c.body}</p>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
export function CodeSection() {
  const steps = [
    { n: "01", title: "Describe the thing", body: "“A pomodoro timer with a calm palette and keyboard shortcuts.”" },
    { n: "02", title: "The agent writes files", body: "It plans, then outputs complete files you can read, copy or download." },
    { n: "03", title: "Run it, then refine", body: "The preview runs in a sandbox with no network. Ask for changes in plain language." },
  ];
  return (
    <Section id="code">
      <div className="grid grid-cols-1 gap-14 lg:grid-cols-2 lg:gap-16 [&>*]:min-w-0">
        <div>
          <SectionHeader index="06" eyebrow="Code" title="Describe it. Watch it run." lead="A small, honest coding agent: HTML, CSS and JavaScript projects with a live, sandboxed preview. It doesn't pretend to deploy anything." />
          <ol className="mt-10 space-y-6">
            {steps.map((s, i) => (
              <li key={s.n}>
                <Reveal delay={i * 0.06} className="grid grid-cols-[44px_1fr] gap-3">
                  <span className="font-mono text-[12px] text-dim">{s.n}</span>
                  <div>
                    <h3 className="text-[16px] font-semibold">{s.title}</h3>
                    <p className="mt-1 text-[14px] text-ink-2">{s.body}</p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>
          <ButtonLink href="/app/code" variant="secondary" className="mt-10">
            Open the code agent <ArrowRight size={15} />
          </ButtonLink>
        </div>
        <Reveal delay={0.1}>
          <div aria-hidden inert className="overflow-hidden rounded-2xl border border-panel-line bg-panel text-panel-ink shadow-[var(--shadow-pop)]">
            <div className="flex items-center gap-2 border-b border-panel-line px-4 py-2.5 font-mono text-[11px] text-panel-dim">
              <Terminal size={13} /> agent session
            </div>
            <div className="grid grid-cols-[140px_1fr]">
              <div className="border-r border-panel-line p-3 font-mono text-[11.5px] text-panel-dim">
                <div className="flex items-center gap-1.5 text-panel-ink">
                  <FolderTree size={12} /> pomodoro
                </div>
                {["index.html", "style.css", "timer.js"].map((f, i) => (
                  <div key={f} className={`mt-1.5 pl-4 ${i === 2 ? "text-panel-ink" : ""}`}>
                    {f}
                  </div>
                ))}
              </div>
              <pre className="overflow-hidden p-4 font-mono text-[11.5px] leading-[1.7]">
                <span className="text-[#7d8487]">{"// timer.js"}</span>
                {"\n"}
                <span className="text-[#b5aaff]">let</span> remaining = <span className="text-[#f2c27b]">25</span> * <span className="text-[#f2c27b]">60</span>;{"\n"}
                <span className="text-[#b5aaff]">function</span> <span className="text-[#8fc1ff]">tick</span>() {"{"}
                {"\n"}  remaining = Math.<span className="text-[#8fc1ff]">max</span>(<span className="text-[#f2c27b]">0</span>, remaining - <span className="text-[#f2c27b]">1</span>);{"\n"}  <span className="text-[#8fc1ff]">render</span>(remaining);{"\n"}
                {"}"}
              </pre>
            </div>
            <div className="border-t border-panel-line p-4 font-mono text-[11.5px] leading-relaxed text-panel-dim">
              <div>
                <span className="text-[#8ed8b6]">✓</span> plan · 3 files
              </div>
              <div>
                <span className="text-[#8ed8b6]">✓</span> wrote index.html, style.css, timer.js
              </div>
              <div>
                <span className="text-[#8ed8b6]">✓</span> preview · sandbox (no network)
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
export function PrivacyBoundary() {
  const local = [
    "Your conversations and their titles",
    "The placeholder map that links [PERSON_1] back to a real name",
    "Generated images, video links and code projects",
    "Settings, default privacy mode and connector permissions",
  ];
  const leaves = [
    "The sanitized conversation, sent to our server and then the model provider",
    "Token and credit counts for billing — never the text",
    "Payments, which are public Solana transactions by nature",
  ];
  const limits = [
    "Detection is heuristic. Unusual names, nicknames and indirect details (“my boss at the only bakery in town”) can slip through.",
    "Context can identify you even after filtering. Strict mode helps, at the cost of vaguer answers.",
    "Images and the contents of files you attach as images are sent as-is.",
    "Model providers receive the sanitized prompt and our server's IP address, under their own data policies. We don't add identifiers.",
    "We don't claim cryptographic anonymity. This is careful data minimisation, applied before anything leaves your device.",
  ];
  return (
    <Section id="privacy-boundary">
      <SectionHeader
        index="07"
        eyebrow="The boundary"
        title={
          <>
            What crosses the line,
            <br />
            and what never does.
          </>
        }
      />
      <div className="mt-14 grid gap-4 lg:grid-cols-2">
        <Reveal className="card p-6 sm:p-7">
          <div className="flex items-center gap-2">
            <Lock size={16} className="text-mint" />
            <h3 className="text-[16px] font-semibold">Stays on this device</h3>
          </div>
          <ul className="mt-5 space-y-3">
            {local.map((l) => (
              <li key={l} className="flex gap-2.5 text-[14px] text-ink-2">
                <Check size={15} className="mt-0.5 shrink-0 text-mint" /> {l}
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal delay={0.06} className="card bg-sunken p-6 sm:p-7">
          <div className="flex items-center gap-2">
            <Server size={16} className="text-accent-ink" />
            <h3 className="text-[16px] font-semibold">Leaves it</h3>
          </div>
          <ul className="mt-5 space-y-3">
            {leaves.map((l) => (
              <li key={l} className="flex gap-2.5 text-[14px] text-ink-2">
                <ArrowRight size={15} className="mt-0.5 shrink-0 text-accent-ink" /> {l}
              </li>
            ))}
          </ul>
          <div className="mt-6 rounded-xl border border-line bg-surface p-4 font-mono text-[12px] leading-relaxed">
            <div className="text-dim">Privacy receipt</div>
            <div className="mt-2">
              <span className="text-dim">YOU SENT </span> Ask Dr. Byrne whether Oisín can swim
            </div>
            <div className="mt-1">
              <span className="text-dim">MODEL GOT</span> Ask Dr. <span className="chip-ph">[PERSON_1]</span> whether <span className="chip-ph">[PERSON_2]</span> can swim
            </div>
          </div>
        </Reveal>
      </div>
      <Reveal delay={0.08} className="mt-4 rounded-2xl border border-amber/30 bg-amber-soft p-6 sm:p-7">
        <h3 className="flex items-center gap-2 text-[16px] font-semibold">
          <BookOpen size={16} /> Limitations, stated plainly
        </h3>
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {limits.map((l) => (
            <li key={l} className="flex gap-2.5 text-[14px] text-ink-2">
              <Minus size={15} className="mt-0.5 shrink-0" /> {l}
            </li>
          ))}
        </ul>
        <Link href="/privacy" className="mt-5 inline-flex items-center gap-1 text-[14px] font-medium hover:underline">
          Read the full privacy model <ArrowRight size={14} />
        </Link>
      </Reveal>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
export function ConnectorSection() {
  const rows = [
    { action: "Read SOL & token balances", mode: "Automatic", tone: "mint" as const, note: "Runs in your browser after you connect" },
    { action: "Read recent transactions", mode: "Automatic", tone: "mint" as const, note: "Addresses become placeholders for the model" },
    { action: "Look up token info", mode: "Automatic", tone: "mint" as const, note: "Public on-chain data" },
    { action: "Prepare a transfer", mode: "Ask every time", tone: "amber" as const, note: "Shown as a preview you approve" },
    { action: "Sign or send", mode: "Your wallet only", tone: "danger" as const, note: "The AI never holds a key" },
  ];
  return (
    <Section id="connect">
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 [&>*]:min-w-0">
        <SectionHeader
          index="08"
          eyebrow="Solana connector"
          title="Reads freely. Never spends."
          lead="Turn on the connector and ask about your wallet in plain language. The model sees your address as a placeholder; anything that moves funds stops at a preview and waits for your wallet."
        />
        <Reveal delay={0.08} className="card overflow-hidden">
          <table className="w-full text-left text-[13.5px]">
            <caption className="sr-only">Connector permissions</caption>
            <thead className="border-b border-line bg-sunken font-mono text-[10.5px] uppercase tracking-wider text-dim">
              <tr>
                <th className="px-5 py-3 font-normal">Action</th>
                <th className="px-5 py-3 font-normal">Permission</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.action} className="border-b border-line-2 last:border-0">
                  <td className="px-5 py-3.5">
                    <div className="font-medium">{r.action}</div>
                    <div className="text-[12.5px] text-dim">{r.note}</div>
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge tone={r.tone}>
                      {r.tone === "danger" ? <X size={10} /> : null}
                      {r.mode}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Reveal>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
export function ApiSection() {
  const { appUrl } = getPublicConfig();
  return (
    <Section id="api">
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 [&>*]:min-w-0">
        <div>
          <SectionHeader
            index="11"
            eyebrow="API"
            title="Private AI for agents and developers."
            lead="An OpenAI-compatible chat completions endpoint. Point your existing client at it, pick any configured model, and optionally ask us to run the privacy filter server-side."
          />
          <ul className="mt-8 space-y-2.5 text-[14px]">
            {["Streaming and non-streaming", "Same models and credits as the app", "Keys hashed at rest, shown once, revocable", "Per-key rate limits and usage"].map((p) => (
              <li key={p} className="flex items-center gap-2.5">
                <Check size={15} className="text-mint" /> {p}
              </li>
            ))}
          </ul>
          <div className="mt-10 flex flex-wrap gap-2">
            <ButtonLink href="/app/developers">Get API key</ButtonLink>
            <ButtonLink href="/app/developers#docs" variant="secondary">
              Read the docs
            </ButtonLink>
          </div>
        </div>
        <Reveal delay={0.08}>
          <div className="overflow-hidden rounded-2xl border border-panel-line bg-panel shadow-[var(--shadow-pop)]">
            <div className="flex items-center justify-between border-b border-panel-line px-4 py-2.5 font-mono text-[11px] text-panel-dim">
              <span>python</span>
              <span>openai SDK</span>
            </div>
            <pre className="scrollbar-thin overflow-x-auto p-5 font-mono text-[12.5px] leading-[1.75] text-panel-ink">
              <code>
                <span className="text-[#b5aaff]">from</span> openai <span className="text-[#b5aaff]">import</span> OpenAI{"\n\n"}client = OpenAI({"\n"}    base_url=<span className="text-[#8ed8b6]">&quot;{appUrl}/api/v1&quot;</span>,{"\n"}    api_key=<span className="text-[#8ed8b6]">&quot;veil_sk_…&quot;</span>,{"\n"}){"\n\n"}resp = client.chat.completions.<span className="text-[#8fc1ff]">create</span>({"\n"}    model=<span className="text-[#8ed8b6]">&quot;auto&quot;</span>,{"\n"}    messages=[{"{"}<span className="text-[#8ed8b6]">&quot;role&quot;</span>: <span className="text-[#8ed8b6]">&quot;user&quot;</span>, <span className="text-[#8ed8b6]">&quot;content&quot;</span>: <span className="text-[#8ed8b6]">&quot;Summarise this contract…&quot;</span>{"}"}],{"\n"}    extra_body={"{"}<span className="text-[#8ed8b6]">&quot;privacy&quot;</span>: <span className="text-[#8ed8b6]">&quot;smart&quot;</span>{"}"},{"\n"}){"\n"}
                <span className="text-[#8fc1ff]">print</span>(resp.choices[<span className="text-[#f2c27b]">0</span>].message.content)
              </code>
            </pre>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
export function FinalCta() {
  return (
    <section className="relative overflow-hidden border-t border-line-2 py-28 md:py-40">
      <div aria-hidden className="grid-paper pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)] opacity-60" />
      <div className="container-x relative text-center">
        <Reveal>
          <LogoMark size={40} className="mx-auto text-ink" />
          <h2 className="display mx-auto mt-8 max-w-4xl text-[clamp(44px,7vw,96px)] text-balance">
            Ask anything.
            <br />
            <em className="italic text-ink-2">Keep it to yourself.</em>
          </h2>
          <p className="lead mx-auto mt-6 text-center">No account to start. No history on our servers. No training on your prompts.</p>
          <div className="mt-10 flex flex-wrap justify-center gap-2.5">
            <ButtonLink href="/app" size="lg">
              Start private chat <ArrowRight size={16} />
            </ButtonLink>
            <ButtonLink href="/app/developers" size="lg" variant="secondary">
              Get API key
            </ButtonLink>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
export function Footer() {
  const cfg = getPublicConfig();
  const cols = [
    {
      title: "Product",
      links: [
        ["Chat", "/app"],
        ["Image", "/app/image"],
        ["Video", "/app/video"],
        ["Code", "/app/code"],
        ["API", "/app/developers"],
        ["Credits", "/app/credits"],
      ],
    },
    {
      title: "Platform",
      links: [
        ["Solutions", "/#solutions"],
        ["Privacy model", "/privacy"],
        ["Solana connector", "/#connect"],
        ["Plans", "/#plans"],
        [`$${cfg.token.symbol} token`, "/#token"],
      ],
    },
    {
      title: "Verify",
      links: [
        ...(cfg.token.links ? ([["pump.fun", cfg.token.links.pump], ["Solana Explorer", cfg.token.links.explorer]] as Array<[string, string]>) : []),
        ["API reference", "/app/developers#docs"],
        ["Status of providers", "/#models"],
      ],
    },
  ];
  return (
    <footer className="border-t border-line bg-sunken">
      <div className="container-x grid gap-12 py-16 md:grid-cols-[1.2fr_2fr]">
        <div>
          <Logo name={cfg.appName} />
          <p className="mt-4 max-w-xs text-[14px] text-ink-2">Private AI. Settled on Solana. History on your device.</p>
          <p className="mt-6 flex items-center gap-1.5 font-mono text-[11px] text-dim">
            <Database size={12} /> Network: {cfg.network}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          {cols.map((c) => (
            <div key={c.title}>
              <p className="eyebrow">{c.title}</p>
              <ul className="mt-4 space-y-2.5 text-[14px]">
                {c.links.map(([l, h]) => (
                  <li key={l}>
                    {h.startsWith("http") ? (
                      <a href={h} target="_blank" rel="noopener noreferrer" className="text-ink-2 transition-colors hover:text-ink">
                        {l} ↗
                      </a>
                    ) : (
                      <Link href={h} className="text-ink-2 transition-colors hover:text-ink">
                        {l}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-line">
        <div className="container-x flex flex-col justify-between gap-2 py-6 text-[12.5px] text-dim sm:flex-row">
          <span>
            © {new Date().getFullYear()} {cfg.appName}. Not financial advice; tokens are volatile.
          </span>
          <span>No cookies for tracking · No analytics scripts</span>
        </div>
      </div>
    </footer>
  );
}
