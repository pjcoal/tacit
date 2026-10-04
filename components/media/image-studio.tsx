"use client";

import { Download, ImageIcon, Shield, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAccount } from "@/components/app/account-provider";
import { PageHeader } from "@/components/app/page-header";
import { useModels } from "@/components/app/use-models";
import { WithPlaceholders } from "@/components/privacy/highlight";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Spinner } from "@/components/ui/spinner";
import { sanitizePrompt, type PrivacyMode } from "@/lib/privacy";
import { deleteImage, listImages, putImage, uid, type StoredImage } from "@/lib/storage/db";
import { useLive } from "@/lib/storage/hooks";
import { apiJson, cn } from "@/lib/utils";
import Link from "next/link";

function b64ToBlob(b64: string, mime: string) {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function ImageTile({ img }: { img: StoredImage }) {
  const url = useMemo(() => URL.createObjectURL(img.blob), [img.blob]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  const ratio = img.aspectRatio.replace(":", "/");
  return (
    <figure className="group relative overflow-hidden rounded-xl border border-line bg-sunken">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={img.prompt} className="w-full object-cover" style={{ aspectRatio: ratio }} />
      <figcaption className="flex items-center gap-2 p-2.5 text-[12px]">
        <span className="line-clamp-1 flex-1 text-ink-2" title={img.prompt}>
          {img.prompt}
        </span>
        <a href={url} download={`image-${img.id.slice(0, 8)}.png`} className="rounded p-1 text-dim hover:text-ink" aria-label="Download">
          <Download size={14} />
        </a>
        <button onClick={() => deleteImage(img.id)} className="rounded p-1 text-dim hover:text-danger" aria-label="Delete">
          <Trash2 size={14} />
        </button>
      </figcaption>
    </figure>
  );
}

export function ImageStudio() {
  const { models } = useModels();
  const { account, refresh } = useAccount();
  const { value: images, ready } = useLive("images", listImages, [] as StoredImage[]);
  const imageModels = models?.image ?? [];
  const [modelId, setModelId] = useState<string>("");
  const model = imageModels.find((m) => m.id === modelId) ?? imageModels.find((m) => m.available) ?? imageModels[0];
  const [prompt, setPrompt] = useState("");
  const [ratio, setRatio] = useState("1:1");
  const [quality, setQuality] = useState("medium");
  const [mode, setMode] = useState<PrivacyMode>("smart");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const preview = useMemo(() => sanitizePrompt(prompt, mode), [prompt, mode]);

  async function generate() {
    if (!model || !prompt.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await apiJson<{ image: { mime: string; b64: string }; credits: number }>("/api/image", {
        method: "POST",
        json: { model: model.id, prompt: preview.sanitized, aspectRatio: model.aspectRatios.includes(ratio) ? ratio : model.aspectRatios[0], quality: model.qualities.length ? quality : undefined },
      });
      await putImage({ id: uid(), createdAt: Date.now(), prompt, sentPrompt: preview.sanitized, model: model.id, aspectRatio: ratio, quality, blob: b64ToBlob(r.image.b64, r.image.mime) });
      refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="scrollbar-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-[1040px] px-5 py-8 sm:py-12">
        <PageHeader icon={ImageIcon} title="Image" description="Generated images are saved in this browser only. The prompt goes through the same privacy filter as chat." />

        <div className="card p-4 sm:p-5">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder="A quiet harbour at dawn, risograph print, two colours…"
            aria-label="Image prompt"
            className="w-full resize-none bg-transparent text-[15px] leading-relaxed outline-none placeholder:text-dim"
          />
          {prompt && preview.replacements.length ? (
            <p className="mt-2 flex items-start gap-1.5 text-[12.5px] text-ink-2">
              <Shield size={13} className="mt-0.5 shrink-0 text-mint" />
              <span>
                Sent as: <WithPlaceholders text={preview.sanitized} />
              </span>
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line-2 pt-4">
            <select
              value={model?.id ?? ""}
              onChange={(e) => setModelId(e.target.value)}
              aria-label="Image model"
              className="h-8 rounded-full border border-line bg-surface px-3 text-[12.5px] outline-none"
            >
              {imageModels.map((m) => (
                <option key={m.id} value={m.id} disabled={!m.available}>
                  {m.label}
                  {m.available ? "" : ` — ${m.providerLabel} not configured`}
                </option>
              ))}
            </select>
            {model ? (
              <Segmented ariaLabel="Aspect ratio" size="sm" value={model.aspectRatios.includes(ratio) ? ratio : model.aspectRatios[0]} onChange={setRatio} options={model.aspectRatios.map((r) => ({ value: r, label: r }))} />
            ) : null}
            {model?.qualities.length ? <Segmented ariaLabel="Quality" size="sm" value={quality} onChange={setQuality} options={model.qualities.map((q) => ({ value: q, label: q[0].toUpperCase() + q.slice(1) }))} /> : null}
            <Segmented ariaLabel="Privacy" size="sm" value={mode} onChange={setMode} options={[{ value: "smart", label: "Smart" }, { value: "strict", label: "Strict" }, { value: "off", label: "Off" }]} />
            <Button className="ml-auto" onClick={generate} disabled={busy || !prompt.trim() || !model?.available || !account}>
              {busy ? <Spinner /> : null} {busy ? "Generating…" : "Generate"}
            </Button>
          </div>
          {!account ? (
            <p className="mt-3 text-[12.5px] text-dim">
              Image generation uses credits. <Link href="/app/credits" className="underline">Create an account and add credits</Link>.
            </p>
          ) : null}
          {models && !imageModels.some((m) => m.available) ? <p className="mt-3 text-[12.5px] text-amber">No image provider is configured on this deployment.</p> : null}
          {err ? <p className="mt-3 text-[13px] text-danger">{err}</p> : null}
        </div>

        <div className="mt-8 flex items-center justify-between">
          <h2 className="eyebrow">On this device · {images.length}</h2>
        </div>
        {busy ? <div className={cn("shimmer mt-3 w-full max-w-xs rounded-xl")} style={{ aspectRatio: ratio.replace(":", "/") }} /> : null}
        {ready && images.length === 0 && !busy ? <p className="mt-3 text-[13.5px] text-dim">Nothing yet. Your images will appear here and nowhere else.</p> : null}
        <div className="mt-3 columns-1 gap-3 sm:columns-2 lg:columns-3 [&>*]:mb-3 [&>*]:break-inside-avoid">
          {images.map((img) => (
            <ImageTile key={img.id} img={img} />
          ))}
        </div>
      </div>
    </div>
  );
}
