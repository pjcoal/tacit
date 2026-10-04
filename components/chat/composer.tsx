"use client";

import * as DM from "@radix-ui/react-dropdown-menu";
import { ArrowUp, Brain, FileText, Paperclip, Shield, ShieldOff, Square, Wallet, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PRIVACY_MODE_INFO, type PrivacyMode } from "@/lib/privacy";
import type { PublicModel } from "@/lib/ai/types";
import { IMAGE_MIME_TYPES, LIMITS, sniffImageMime, TEXT_EXTENSIONS } from "@/lib/security/uploads";
import type { StoredAttachment } from "@/lib/storage/db";
import { cn } from "@/lib/utils";
import type { ReasoningLevel, WireImage } from "@/types/chat";
import type { SendInput } from "./use-chat";

interface Pending {
  id: string;
  attachment: StoredAttachment;
  image?: WireImage;
  text?: { name: string; content: string };
}

export interface ComposerSettings {
  model: string;
  mode: PrivacyMode;
  reasoning: ReasoningLevel;
  solana: boolean;
}

function readAs(file: Blob, kind: "dataUrl" | "text" | "buffer"): Promise<string | ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string | ArrayBuffer);
    r.onerror = () => reject(r.error);
    if (kind === "dataUrl") r.readAsDataURL(file);
    else if (kind === "text") r.readAsText(file);
    else r.readAsArrayBuffer(file);
  });
}

export function Composer({
  models,
  settings,
  onSettings,
  onSend,
  onStop,
  streaming,
  autoFocus,
}: {
  models: PublicModel[] | null;
  settings: ComposerSettings;
  onSettings: (patch: Partial<ComposerSettings>) => void;
  onSend: (input: SendInput) => void;
  onStop: () => void;
  streaming: boolean;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState("");
  const [pending, setPending] = useState<Pending[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const ta = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const model = models?.find((m) => m.id === settings.model);

  // Focus on desktop only — on phones it would pop the keyboard over the page.
  useEffect(() => {
    if (autoFocus && window.matchMedia("(pointer: fine)").matches) ta.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  }, [text]);

  async function addFiles(files: FileList | File[]) {
    setFileError(null);
    const next: Pending[] = [];
    for (const f of Array.from(files)) {
      const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
      if ((IMAGE_MIME_TYPES as readonly string[]).includes(f.type)) {
        if (pending.filter((p) => p.image).length + next.filter((p) => p.image).length >= LIMITS.maxImagesPerMessage) {
          setFileError(`Up to ${LIMITS.maxImagesPerMessage} images per message.`);
          continue;
        }
        if (f.size > LIMITS.maxImageBytes) {
          setFileError(`${f.name} is larger than 5 MB.`);
          continue;
        }
        const sniffed = sniffImageMime(new Uint8Array((await readAs(f.slice(0, 16), "buffer")) as ArrayBuffer));
        if (!sniffed || sniffed !== f.type) {
          setFileError(`${f.name} doesn't look like a valid ${f.type.split("/")[1]} image.`);
          continue;
        }
        const dataUrl = (await readAs(f, "dataUrl")) as string;
        next.push({
          id: crypto.randomUUID(),
          attachment: { kind: "image", name: f.name, mime: f.type, size: f.size, dataUrl },
          image: { mime: sniffed, data: dataUrl.split(",")[1] },
        });
      } else if (TEXT_EXTENSIONS.includes(ext) || f.type.startsWith("text/")) {
        if (f.size > LIMITS.maxTextFileBytes) {
          setFileError(`${f.name} is larger than ${LIMITS.maxTextFileBytes / 1024} KB.`);
          continue;
        }
        const content = (await readAs(f, "text")) as string;
        if (content.includes("\u0000")) {
          setFileError(`${f.name} looks like a binary file.`);
          continue;
        }
        next.push({ id: crypto.randomUUID(), attachment: { kind: "text", name: f.name, mime: f.type || "text/plain", size: f.size }, text: { name: f.name, content } });
      } else {
        setFileError(`${f.name}: only images (PNG, JPEG, WEBP, GIF) and text/code files are supported. PDFs are coming soon.`);
      }
    }
    setPending((p) => [...p, ...next].slice(0, LIMITS.maxImagesPerMessage + LIMITS.maxTextFilesPerMessage));
  }

  const hasImages = pending.some((p) => p.image);
  const visionBlocked = hasImages && model && !model.vision;
  const canSend = !streaming && (text.trim().length > 0 || pending.length > 0) && !visionBlocked && Boolean(model?.available);

  function submit() {
    if (!canSend) return;
    onSend({
      text: text.trim(),
      images: pending.flatMap((p) => (p.image ? [p.image] : [])),
      textFiles: pending.flatMap((p) => (p.text ? [p.text] : [])),
      attachments: pending.map((p) => p.attachment),
      model: settings.model,
      mode: settings.mode,
      reasoning: settings.reasoning,
      tools: settings.solana && model?.tools ? ["solana"] : [],
    });
    setText("");
    setPending([]);
  }

  const ModeIcon = settings.mode === "off" ? ShieldOff : Shield;

  return (
    <div
      className="rounded-2xl border border-line bg-surface shadow-[0_1px_0_rgba(0,0,0,0.03),0_8px_24px_-16px_rgba(0,0,0,0.25)] transition-colors focus-within:border-ink/30"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
      }}
    >
      {pending.length ? (
        <div className="flex flex-wrap gap-2 px-3 pt-3">
          {pending.map((p) => (
            <span key={p.id} className="group relative flex h-12 items-center gap-2 rounded-lg border border-line bg-sunken pr-7 pl-1.5 text-[12px]">
              {p.attachment.dataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.attachment.dataUrl} alt="" className="h-9 w-9 rounded-md object-cover" />
              ) : (
                <span className="grid h-9 w-9 place-items-center rounded-md bg-surface">
                  <FileText size={15} />
                </span>
              )}
              <span className="max-w-[140px] truncate">{p.attachment.name}</span>
              <button onClick={() => setPending((x) => x.filter((y) => y.id !== p.id))} className="absolute top-1 right-1 rounded p-0.5 text-dim hover:text-ink" aria-label={`Remove ${p.attachment.name}`}>
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <textarea
        ref={ta}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
        onPaste={(e) => {
          const files = Array.from(e.clipboardData.files);
          if (files.length) {
            e.preventDefault();
            addFiles(files);
          }
        }}
        rows={1}
        placeholder="Ask anything…"
        aria-label="Message"
        className="block max-h-[240px] w-full resize-none bg-transparent px-4 pt-3.5 pb-1 text-[15px] leading-relaxed outline-none placeholder:text-dim focus-visible:outline-none"
        data-testid="composer-input"
      />

      <div className="flex items-center gap-1.5 px-2.5 pt-1 pb-2.5">
        <button onClick={() => fileInput.current?.click()} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-ink/5 hover:text-ink" aria-label="Attach files" title="Attach images or text files">
          <Paperclip size={16} />
        </button>
        <input
          ref={fileInput}
          type="file"
          multiple
          hidden
          accept={[...IMAGE_MIME_TYPES, ...TEXT_EXTENSIONS.map((e) => `.${e}`)].join(",")}
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <div className="no-scrollbar flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">

          {model && model.reasoning.length > 0 ? (
            <DM.Root>
              <DM.Trigger className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[12.5px] outline-none hover:border-ink/30" aria-label="Reasoning level">
                <Brain size={13} className="text-dim" /> <span className="capitalize">{model.reasoning.includes(settings.reasoning) ? settings.reasoning : model.reasoning[0]}</span>
              </DM.Trigger>
              <DM.Portal>
                <DM.Content side="top" sideOffset={8} className="z-[70] w-[200px] rounded-xl border border-line bg-surface p-1.5 shadow-[var(--shadow-pop)]">
                  <DM.Label className="eyebrow px-2.5 pt-1.5 pb-1">Reasoning</DM.Label>
                  {model.reasoning.map((r) => (
                    <DM.Item key={r} onSelect={() => onSettings({ reasoning: r })} className="cursor-pointer rounded-lg px-2.5 py-1.5 text-[13px] capitalize outline-none data-[highlighted]:bg-sunken">
                      {r}
                    </DM.Item>
                  ))}
                </DM.Content>
              </DM.Portal>
            </DM.Root>
          ) : null}

          <DM.Root>
            <DM.Trigger
              className={cn(
                "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12.5px] outline-none",
                settings.mode === "off" ? "border-amber/40 bg-amber-soft text-amber" : "border-accent-line bg-accent-soft text-accent-ink",
              )}
              aria-label="Privacy mode"
              data-testid="privacy-mode"
            >
              <ModeIcon size={13} /> {PRIVACY_MODE_INFO[settings.mode].label}
            </DM.Trigger>
            <DM.Portal>
              <DM.Content side="top" sideOffset={8} className="z-[70] w-[280px] rounded-xl border border-line bg-surface p-1.5 shadow-[var(--shadow-pop)]">
                <DM.Label className="eyebrow px-2.5 pt-1.5 pb-1">Privacy filter</DM.Label>
                {(["smart", "strict", "off"] as const).map((m) => (
                  <DM.Item key={m} onSelect={() => onSettings({ mode: m })} className="cursor-pointer rounded-lg px-2.5 py-2 outline-none data-[highlighted]:bg-sunken">
                    <span className="block text-[13px] font-medium">
                      {PRIVACY_MODE_INFO[m].label} {settings.mode === m ? "✓" : ""}
                    </span>
                    <span className="block text-[11.5px] text-dim">{PRIVACY_MODE_INFO[m].short}</span>
                  </DM.Item>
                ))}
              </DM.Content>
            </DM.Portal>
          </DM.Root>

          <button
            onClick={() => onSettings({ solana: !settings.solana })}
            disabled={Boolean(model && !model.tools)}
            title={model && !model.tools ? `${model.label} doesn't support tools` : "Let the model read your connected wallet and prepare transfers for your approval"}
            className={cn(
              "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12.5px] transition-colors disabled:opacity-40",
              settings.solana && model?.tools ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink-2 hover:border-ink/30",
            )}
            aria-pressed={settings.solana}
            data-testid="solana-tools"
          >
            <Wallet size={13} /> Solana
          </button>
        </div>

        {streaming ? (
          <button onClick={onStop} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink text-bg" aria-label="Stop generating" data-testid="stop">
            <Square size={13} fill="currentColor" />
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={!canSend}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink text-bg transition-opacity disabled:opacity-25"
            aria-label="Send"
            data-testid="send"
          >
            <ArrowUp size={17} />
          </button>
        )}
      </div>
      {fileError || visionBlocked ? (
        <p className="border-t border-line-2 px-4 py-2 text-[12px] text-danger">{visionBlocked ? `${model?.label} can't read images — pick a model with vision, or remove the image.` : fileError}</p>
      ) : null}
    </div>
  );
}
