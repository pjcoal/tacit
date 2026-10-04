import { ArrowRight, Database, EyeOff, ShieldCheck, Wallet } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { restoreResponse, sanitizePrompt } from "@/lib/privacy";
import { PipelineVisual, type PipelineData } from "./pipeline-visual";

const SAMPLE = "Remind Maya Okafor to send the lease for 41 Harbour Road to maya.okafor@proton.me before Friday.";
const SAMPLE_REPLY = "Hi [PERSON_1], a quick reminder to send the lease for [ADDRESS_1] to [EMAIL_1] before Friday. Thank you!";

/** The hero diagram is produced by the real sanitizer at render time, not hand-written. */
function pipelineData(): PipelineData {
  const r = sanitizePrompt(SAMPLE, "smart");
  return {
    original: SAMPLE,
    sanitized: r.sanitized,
    replacements: r.replacements,
    modelReply: SAMPLE_REPLY,
    restored: restoreResponse(SAMPLE_REPLY, r.map),
  };
}

const TRUST = [
  { icon: Database, label: "Browser-local history" },
  { icon: ShieldCheck, label: "Privacy filtering" },
  { icon: EyeOff, label: "No ad tracking" },
  { icon: Wallet, label: "Wallet optional" },
];

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-32 pb-20 md:pt-40 md:pb-28">
      <div aria-hidden className="hero-art pointer-events-none absolute inset-x-0 top-0 h-[560px] md:h-[760px]" />
      <div className="container-x relative">
        <p className="eyebrow flex items-center gap-2">
          <span className="dot bg-accent" /> Private AI · Settled on Solana
        </p>
        <div>
          <h1 className="display mt-6 text-[clamp(52px,9.4vw,124px)] text-balance">
            Ask anything.
            <br />
            <span className="text-ink-2">
              Leave <em className="italic text-ink">nothing</em> behind.
            </span>
          </h1>
        </div>
        <div className="mt-8 grid gap-10 md:mt-10 md:grid-cols-[1.1fr_1fr] md:items-end">
          <div className="rise" style={{ animationDelay: "60ms" }}>
            <p className="lead !max-w-[52ch] text-[17px] md:text-[18px]">
              One quiet interface to the leading AI models. Names, places, contact details and wallet addresses are swapped
              for placeholders <strong className="font-medium text-ink">on your device</strong> before a request leaves it.
              Your history stays in your browser, we never train on your prompts, and you can start without an account.
            </p>
          </div>
          <div className="rise flex flex-col gap-5 md:items-end" style={{ animationDelay: "120ms" }}>
            <div className="grid gap-2.5 sm:flex sm:flex-wrap">
              <ButtonLink href="/app" size="lg" className="group">
                Start private chat
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
              </ButtonLink>
              <ButtonLink href="/#privacy" variant="secondary" size="lg">
                How privacy works
              </ButtonLink>
            </div>
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-ink-2">
              {TRUST.map((t) => (
                <li key={t.label} className="flex items-center gap-1.5">
                  <t.icon size={14} className="text-dim" />
                  {t.label}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="rise mt-16 md:mt-24" style={{ animationDelay: "200ms" }}>
          <PipelineVisual data={pipelineData()} />
        </div>
      </div>
    </section>
  );
}
