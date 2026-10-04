import { ArrowUp, Check, Eye, Lock, Paperclip, ShieldCheck, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { LogoMark } from "@/components/ui/logo";
import { Reveal } from "@/components/ui/reveal";
import { getPublicConfig } from "@/server/public-config";

/** A static browser window around a faithful mock of a real app screen. */
function Window({ title, caption, children, className }: { title: string; caption: string; children: ReactNode; className?: string }) {
  return (
    <figure className={className}>
      <div aria-hidden inert className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-pop)] select-none">
        <div className="flex items-center gap-3 border-b border-line bg-sunken px-4 py-3">
          <span className="flex gap-1.5">
            <span className="h-[11px] w-[11px] rounded-full bg-[#ec6a5e]" />
            <span className="h-[11px] w-[11px] rounded-full bg-[#f4bf4f]" />
            <span className="h-[11px] w-[11px] rounded-full bg-[#61c554]" />
          </span>
          <span className="truncate font-mono text-[12px] text-dim">{title}</span>
        </div>
        {children}
      </div>
      <figcaption className="mt-4 text-center font-mono text-[12px] text-dim">{caption}</figcaption>
    </figure>
  );
}

function Pill({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "accent" }) {
  return (
    <span
      className={
        tone === "accent"
          ? "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-accent-line bg-accent-soft px-3 text-[12.5px] text-accent-ink"
          : "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[12.5px] text-ink-2"
      }
    >
      {children}
    </span>
  );
}

function Tag({ children, tone }: { children: ReactNode; tone: "mint" | "accent" | "plain" }) {
  const cls =
    tone === "mint" ? "bg-mint-soft text-mint" : tone === "accent" ? "bg-accent-soft text-accent-ink" : "border border-line text-ink-2";
  return <span className={`inline-flex h-[22px] items-center rounded-md px-2 font-mono text-[10.5px] tracking-[0.08em] uppercase ${cls}`}>{children}</span>;
}

/** "This is the actual app": the chat home screen, a privacy receipt and the Solana connector. */
export function AppShowcase() {
  const { appName, freeDailyMessages } = getPublicConfig();
  return (
    <section id="app" className="scroll-mt-20 py-20 md:py-28">
      <div className="container-x">
        <Reveal className="mx-auto max-w-[760px] text-center">
          <p className="eyebrow">The app</p>
          <h2 className="display mt-4 text-[clamp(40px,6vw,76px)] text-balance">This is the actual app.</h2>
          <p className="mx-auto mt-5 max-w-[60ch] text-[17px] leading-relaxed text-ink-2">
            Fast, quiet and private by default. Chat, code and the connector all sit behind the same filter: no email, no prompt logs, and history that
            lives in your browser.
          </p>
        </Reveal>

        {/* Home screen */}
        <Reveal delay={0.05} className="mt-14">
          <Window title={`${appName} · Chat`} caption="Chat, the home screen">
            <div className="flex flex-col items-center px-5 pt-14 pb-12 text-center sm:pt-16 sm:pb-14">
              <LogoMark size={44} className="text-ink" />
              <p className="display mt-6 text-[clamp(32px,4.4vw,52px)]">Build in private.</p>
              <p className="mt-4 font-mono text-[12px] text-ink-2">Auto · best route per prompt · filtered on your device · history in this browser</p>
              <div className="mt-8 w-full max-w-[620px] rounded-2xl border border-line bg-surface text-left shadow-[0_1px_0_var(--line-2)]">
                <p className="px-4 pt-3.5 pb-1 text-[15px] text-dim">Ask anything…</p>
                <div className="flex items-center gap-1.5 px-2.5 pt-1 pb-2.5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-2">
                    <Paperclip size={16} />
                  </span>
                  <div className="flex min-w-0 flex-1 gap-1.5 overflow-hidden">
                    <Pill tone="accent">
                      <ShieldCheck size={13} /> Smart
                    </Pill>
                    <span className="hidden sm:inline-flex">
                      <Pill>
                        <Wallet size={13} /> Solana
                      </Pill>
                    </span>
                  </div>
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink text-bg">
                    <ArrowUp size={17} />
                  </span>
                </div>
              </div>
              <p className="mt-5 flex items-center gap-1.5 text-[12.5px] text-dim">
                <Lock size={12} />
                {freeDailyMessages > 0 ? `Free: ${freeDailyMessages} messages a day. No account needed.` : "No account needed to start."}
              </p>
            </div>
          </Window>
        </Reveal>

        <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-8 [&>*]:min-w-0">
          {/* Receipt */}
          <Reveal delay={0.05}>
            <Window title="Privacy receipt" caption="Every message gets a receipt">
              <div className="space-y-4 p-5 sm:p-6">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 font-mono text-[11.5px] text-mint">
                    <ShieldCheck size={13} /> 3 replaced before sending
                  </span>
                  <span className="font-mono text-[10.5px] text-dim uppercase">mode · smart</span>
                </div>
                <div>
                  <p className="eyebrow mb-1.5">You sent</p>
                  <p className="text-[14px] leading-relaxed">
                    Why was <mark className="chip-orig">daniel@northwind.io</mark> charged twice? Ask <mark className="chip-orig">Priya</mark> to check
                    server <mark className="chip-orig">84.203.17.9</mark>.
                  </p>
                </div>
                <div>
                  <p className="eyebrow mb-1.5">Model received</p>
                  <p className="rounded-lg bg-sunken p-3 text-[14px] leading-relaxed">
                    Why was <span className="chip-ph">[EMAIL_1]</span> charged twice? Ask <span className="chip-ph">[PERSON_1]</span> to check server{" "}
                    <span className="chip-ph">[IP_1]</span>.
                  </p>
                </div>
                <ul className="grid gap-1.5 border-t border-line-2 pt-4 font-mono text-[12px]">
                  {[
                    ["[EMAIL_1]", "daniel@northwind.io"],
                    ["[PERSON_1]", "Priya"],
                    ["[IP_1]", "84.203.17.9"],
                  ].map(([ph, v]) => (
                    <li key={ph} className="flex items-center gap-2">
                      <span className="chip-ph">{ph}</span>
                      <span className="text-dim">←</span>
                      <span className="truncate">{v}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-[11.5px] text-dim">The mapping stays in this browser.</p>
              </div>
            </Window>
          </Reveal>

          {/* Connector */}
          <Reveal delay={0.1}>
            <Window title="Connect" caption="Connect, the Solana connector">
              <div className="space-y-3 p-5 sm:p-6">
                {[
                  { mark: "◎", bg: "bg-[linear-gradient(135deg,#9945ff,#14f195)] text-white", name: "Solana wallet", tag: <Tag tone="mint">Connected</Tag>, sub: "balances · tokens · history" },
                  { mark: <Eye size={16} />, bg: "bg-ink text-bg", name: "Read tools", tag: <Tag tone="plain">In browser</Tag>, sub: "run on your device, not our servers" },
                  { mark: <Wallet size={16} />, bg: "bg-accent text-white", name: "Transfers", tag: <Tag tone="accent">Preview only</Tag>, sub: "prepared by the AI · signed by you" },
                ].map((r) => (
                  <div key={r.name} className="flex items-center gap-3.5 rounded-xl border border-line bg-bg p-3.5">
                    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg text-[18px] font-semibold ${r.bg}`}>{r.mark}</span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[15px] font-medium">{r.name}</span>
                        {r.tag}
                      </div>
                      <p className="mt-0.5 font-mono text-[12px] text-dim">{r.sub}</p>
                    </div>
                  </div>
                ))}
                <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-line bg-sunken p-3.5 sm:flex-row sm:items-center">
                  <span className="font-mono text-[12.5px]">AI sends funds</span>
                  <span className="flex overflow-hidden rounded-lg border border-line text-[12px]">
                    <span className="bg-ink px-3 py-1.5 whitespace-nowrap text-bg">Never</span>
                    <span className="px-3 py-1.5 whitespace-nowrap text-dim">Your wallet decides</span>
                  </span>
                </div>
                <p className="flex items-start gap-1.5 text-[11.5px] leading-relaxed text-dim">
                  <Check size={12} className="mt-0.5 shrink-0" /> Your address reaches the model only as a placeholder. Every transfer opens in your own
                  wallet for approval.
                </p>
              </div>
            </Window>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
