import { ArrowUp, Check, FileCode2, Lock, Paperclip, ShieldCheck, Wallet } from "lucide-react";
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

          {/* Code */}
          <Reveal delay={0.1}>
            <Window title="Code" caption="Code, the build agent">
              <div className="space-y-4 p-5 sm:p-6">
                <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-sunken px-4 py-2.5 text-[14px]">
                  Build a waitlist page for Kestrel with an email signup.
                </div>
                <div className="grid grid-cols-[120px_1fr] overflow-hidden rounded-xl border border-line sm:grid-cols-[140px_1fr]">
                  <ul className="space-y-0.5 border-r border-line bg-sunken p-2 font-mono text-[12px]">
                    {[
                      ["index.html", true],
                      ["styles.css", false],
                      ["app.js", false],
                    ].map(([f, active]) => (
                      <li key={f as string} className={`flex items-center gap-1.5 truncate rounded-md px-2 py-1.5 ${active ? "bg-surface text-ink" : "text-ink-2"}`}>
                        <FileCode2 size={12} className="shrink-0 text-dim" /> {f as string}
                      </li>
                    ))}
                  </ul>
                  <div className="bg-[#fbfbf9] p-4 text-[#101113]">
                    <p className="font-serif text-[22px] leading-none">Kestrel</p>
                    <p className="mt-2 text-[12px] text-[#4a4e52]">Analytics that respect your users. Join the waitlist.</p>
                    <div className="mt-3 flex gap-1.5">
                      <span className="h-8 min-w-0 flex-1 rounded-md border border-black/15 bg-white px-2 text-[11.5px] leading-8 text-[#6b7073]">you@company.com</span>
                      <span className="h-8 shrink-0 rounded-md bg-[#101113] px-3 text-[11.5px] leading-8 text-white">Join</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Tag tone="mint">Sandboxed preview</Tag>
                  <Tag tone="plain">No network</Tag>
                  <Tag tone="plain">3 files</Tag>
                </div>
                <p className="flex items-start gap-1.5 text-[11.5px] leading-relaxed text-dim">
                  <Check size={12} className="mt-0.5 shrink-0" /> Every file is shown in full. The preview runs locked down, with no access to your session or the
                  network.
                </p>
              </div>
            </Window>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
