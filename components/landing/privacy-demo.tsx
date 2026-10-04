"use client";

import { AnimatePresence, m } from "framer-motion";
import { ArrowRight, Cpu, Laptop, Lock, MonitorSmartphone } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { WithOriginals, WithPlaceholders } from "@/components/privacy/highlight";
import { Segmented } from "@/components/ui/segmented";
import { PRIVACY_MODE_INFO, restoreResponse, sanitizePrompt, type PrivacyMode } from "@/lib/privacy";
import { cn } from "@/lib/utils";

const PRESETS = [
  {
    id: "dinner",
    label: "Restaurants",
    text: "Find restaurants near my home in New York and send the shortlist to Elena.",
    reply: (p: string[]) => `Here are four places within walking distance in ${p[0] ?? "the area"}. I've drafted a short note for ${p[1] ?? "them"} with the shortlist.`,
  },
  {
    id: "transfer",
    label: "Wallet",
    text: "Prepare a transfer of 2 SOL to 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM and tell Priya it's for the New York trip.",
    reply: (p: string[]) => `I've prepared a 2 SOL transfer to ${p[0] ?? "that address"} for you to review in your wallet, plus a note for ${p[1] ?? "them"} about the ${p[2] ?? ""} trip.`,
  },
  {
    id: "health",
    label: "Health",
    text: "My son Oisín was born on 14 March 2016 and has asthma. Dr. Byrne at Beaumont Hospital suggested a new inhaler. What should I ask?",
    reply: (p: string[]) => `Good questions for ${p.find((x) => x.startsWith("[PERSON")) ?? "the doctor"}: how the new inhaler differs, the right spacer for a child, and what to do if symptoms flare at night.`,
  },
  {
    id: "email",
    label: "Email",
    text: "Draft a reply to james.whelan@acme.ie saying I can meet Thursday at 3pm. If it's easier, call me on 087 123 4567.",
    reply: (p: string[]) => `Here's a draft for ${p[0] ?? "them"}: "Thursday at 3pm works for me. If it's easier, call me on ${p[1] ?? "my mobile"}."`,
  },
];

function Column({ icon: Icon, step, title, where, tone, children }: { icon: typeof Laptop; step: string; title: string; where: string; tone: "local" | "remote"; children: React.ReactNode }) {
  return (
    <div className={cn("card flex min-h-[188px] flex-col p-4", tone === "remote" && "bg-sunken")}>
      <div className="flex items-center justify-between">
        <span className="eyebrow flex items-center gap-1.5 !text-ink">
          <span className="text-dim">{step}</span> {title}
        </span>
        <span className={cn("flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider", tone === "local" ? "text-mint" : "text-accent-ink")}>
          <Icon size={11} /> {where}
        </span>
      </div>
      <div className="mt-3 flex-1 text-[14px] leading-relaxed">{children}</div>
    </div>
  );
}

export function PrivacyDemo() {
  const [presetId, setPresetId] = useState(PRESETS[0].id);
  const [text, setText] = useState(PRESETS[0].text);
  const [mode, setMode] = useState<PrivacyMode>("smart");
  const preset = PRESETS.find((p) => p.id === presetId);

  const result = useMemo(() => sanitizePrompt(text, mode), [text, mode]);
  const placeholders = result.replacements.map((r) => r.placeholder);
  const reply =
    preset && text === preset.text
      ? preset.reply(placeholders)
      : placeholders.length
        ? `Here's a draft that refers to ${placeholders.slice(0, 3).join(", ")}. Your browser swaps the real values back in when it arrives.`
        : "Here's my answer. Nothing in your message needed replacing.";
  const providerBody = JSON.stringify({ model: "auto", messages: [{ role: "user", content: result.sanitized }] }, null, 2);

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="no-scrollbar -mx-5 flex gap-1.5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setPresetId(p.id);
                setText(p.text);
              }}
              className={cn(
                "h-8 shrink-0 rounded-full border px-3.5 text-[13px] transition-colors",
                presetId === p.id && text === p.text ? "border-ink bg-ink text-bg" : "border-line text-ink-2 hover:border-ink/30 hover:text-ink",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <Segmented
          ariaLabel="Privacy mode"
          value={mode}
          onChange={setMode}
          options={(["smart", "strict", "off"] as const).map((v) => ({ value: v, label: PRIVACY_MODE_INFO[v].label, title: PRIVACY_MODE_INFO[v].short }))}
        />
      </div>

      <label className="mt-4 block">
        <span className="sr-only">Try your own prompt</span>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value.slice(0, 600));
            setPresetId("");
          }}
          rows={2}
          className="card w-full resize-none px-4 py-3.5 text-[15px] leading-relaxed outline-none transition-colors focus:border-ink/40"
          placeholder="Type anything with a name, place, email, phone number or wallet…"
        />
      </label>
      <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-dim">
        <Lock size={12} /> Runs in this page with the same filter the app uses. Nothing you type here is sent anywhere.
      </p>

      <div className="mt-8 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Column icon={Laptop} step="01" title="You type" where="Device" tone="local">
          <WithOriginals text={text} values={result.replacements.map((r) => r.value)} />
        </Column>
        <Column icon={Laptop} step="02" title="Sanitized" where="Device" tone="local">
          <AnimatePresence mode="popLayout" initial={false}>
            <m.div key={result.sanitized} initial={{ opacity: 0.3 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
              <WithPlaceholders text={result.sanitized} />
            </m.div>
          </AnimatePresence>
        </Column>
        <Column icon={Cpu} step="03" title="Provider receives" where="Model" tone="remote">
          <pre className="scrollbar-thin overflow-x-auto rounded-lg bg-panel p-3 font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap text-panel-ink">{providerBody}</pre>
        </Column>
        <Column icon={MonitorSmartphone} step="04" title="Restored for you" where="Device" tone="local">
          <WithOriginals text={restoreResponse(reply, result.map)} values={result.replacements.map((r) => r.value)} />
          <span className="mt-2 block font-mono text-[10.5px] uppercase tracking-wider text-dim">Illustrative reply</span>
        </Column>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-start">
        <div className="card overflow-hidden">
          <table className="w-full text-left text-[13px]">
            <caption className="sr-only">What was replaced</caption>
            <thead className="border-b border-line bg-sunken font-mono text-[10.5px] uppercase tracking-wider text-dim">
              <tr>
                <th className="px-4 py-2.5 font-normal">Type</th>
                <th className="px-4 py-2.5 font-normal">Original (stays local)</th>
                <th className="px-4 py-2.5 font-normal">Sent as</th>
              </tr>
            </thead>
            <tbody>
              {result.replacements.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-4 text-ink-2">
                    {mode === "off" ? "Filtering is off — this text would be sent as written." : "Nothing detected. Try adding a name, city, email or wallet."}
                  </td>
                </tr>
              ) : (
                result.replacements.map((r) => (
                  <tr key={r.placeholder} className="border-b border-line-2 last:border-0">
                    <td className="px-4 py-2.5 font-mono text-[11.5px] text-ink-2">{r.type}</td>
                    <td className="max-w-[260px] truncate px-4 py-2.5">{r.value}</td>
                    <td className="px-4 py-2.5">
                      <span className="chip-ph">{r.placeholder}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="max-w-sm text-[13.5px] text-ink-2">
          <p>{PRIVACY_MODE_INFO[mode].short}</p>
          <Link href="/privacy" className="mt-3 inline-flex items-center gap-1 font-medium text-ink hover:underline">
            What it catches, and what it can miss <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}
