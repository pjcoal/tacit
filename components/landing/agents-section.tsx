import { ArrowRight, Bot, HardDrive, ShieldCheck, SlidersHorizontal, Wallet } from "lucide-react";
import { AgentAvatar } from "@/components/agents/agent-avatar";
import { ButtonLink } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";

const POINTS = [
  { icon: SlidersHorizontal, title: "Your instructions", body: "Give it a role, a focus, a tone and an answer format. Add starters for the jobs you repeat." },
  { icon: ShieldCheck, title: "Filtered like everything else", body: "Instructions go through the same privacy filter as your messages. Pick Smart, Strict or Off per agent." },
  { icon: Wallet, title: "Optional Solana tools", body: "Let an agent read your wallet and prepare transfers that you approve in your own wallet." },
  { icon: HardDrive, title: "Saved in your browser", body: "Agents live on this device next to your history. No profile, no public gallery." },
];

/** Homepage section for custom agents, with a faithful mock of the agent editor. */
export function AgentsSection() {
  return (
    <section id="agents" className="scroll-mt-20 py-20 md:py-28">
      <div className="container-x grid grid-cols-1 items-center gap-12 lg:grid-cols-[1fr_1fr] lg:gap-16 [&>*]:min-w-0">
        <Reveal>
          <p className="eyebrow flex items-center gap-1.5">
            <Bot size={12} /> Agents
          </p>
          <h2 className="display mt-4 text-[clamp(40px,5.6vw,72px)] text-balance">
            Build your own agent.
            <br />
            <span className="text-ink-2">Keep it private.</span>
          </h2>
          <p className="mt-5 max-w-[52ch] text-[16.5px] leading-relaxed text-ink-2">
            Turn the prompts you keep rewriting into agents: a code reviewer, an incident responder, a wallet analyst. Set them up once, then start a
            chat with one click.
          </p>
          <ul className="mt-8 grid gap-5 sm:grid-cols-2">
            {POINTS.map((p) => (
              <li key={p.title}>
                <p.icon size={17} strokeWidth={1.7} />
                <h3 className="mt-2.5 text-[14.5px] font-semibold">{p.title}</h3>
                <p className="mt-1 text-[13.5px] leading-relaxed text-ink-2">{p.body}</p>
              </li>
            ))}
          </ul>
          <ButtonLink href="/app/agents" size="lg" className="group mt-9">
            Build an agent <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
          </ButtonLink>
        </Reveal>

        <Reveal delay={0.1}>
          <div aria-hidden inert className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-pop)] select-none">
            <div className="flex items-center gap-3 border-b border-line bg-sunken px-4 py-3">
              <span className="flex gap-1.5">
                <span className="h-[11px] w-[11px] rounded-full bg-[#ec6a5e]" />
                <span className="h-[11px] w-[11px] rounded-full bg-[#f4bf4f]" />
                <span className="h-[11px] w-[11px] rounded-full bg-[#61c554]" />
              </span>
              <span className="font-mono text-[12px] text-dim">Agents · New agent</span>
            </div>
            <div className="space-y-4 p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <AgentAvatar name="Release captain" size={44} />
                <div className="min-w-0">
                  <p className="text-[16px] font-semibold">Release captain</p>
                  <p className="text-[13px] text-ink-2">Keeps releases boring.</p>
                </div>
              </div>
              <div>
                <p className="eyebrow mb-1.5">Instructions</p>
                <div className="rounded-xl border border-line bg-bg p-3.5 text-[13.5px] leading-relaxed">
                  Answer as a checklist. Check migrations, feature flags and rollback steps before anything ships. Escalate to{" "}
                  <mark className="chip-orig">priya@northwind.io</mark> if a step fails.
                </div>
                <p className="mt-1.5 text-[11.5px] text-mint">1 detail here will be swapped for placeholders before sending.</p>
              </div>
              <div>
                <p className="eyebrow mb-1.5">Starters</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {["Plan tonight's release", "Write the rollback steps"].map((s) => (
                    <span key={s} className="rounded-lg border border-line bg-bg px-3 py-2 text-[13px] text-ink-2">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t border-line-2 pt-4">
                <span className="inline-flex h-[24px] items-center gap-1 rounded-md bg-accent-soft px-2 font-mono text-[10.5px] tracking-[0.06em] text-accent-ink uppercase">
                  <ShieldCheck size={11} /> Strict
                </span>
                <span className="inline-flex h-[24px] items-center gap-1 rounded-md border border-line px-2 font-mono text-[10.5px] tracking-[0.06em] text-ink-2 uppercase">
                  <HardDrive size={11} /> This browser
                </span>
                <span className="ml-auto inline-flex h-9 items-center rounded-lg bg-ink px-3.5 text-[13px] font-medium text-bg">Save &amp; chat</span>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
