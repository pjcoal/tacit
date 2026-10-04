"use client";

import { Download, Film, ImagePlus, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAccount } from "@/components/app/account-provider";
import { PageHeader } from "@/components/app/page-header";
import { useModels } from "@/components/app/use-models";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Spinner } from "@/components/ui/spinner";
import { sanitizePrompt } from "@/lib/privacy";
import { sniffImageMime } from "@/lib/security/uploads";
import { deleteVideo, listVideos, putVideo, uid, type StoredVideo } from "@/lib/storage/db";
import { useLive } from "@/lib/storage/hooks";
import { apiJson } from "@/lib/utils";

function VideoCard({ v }: { v: StoredVideo }) {
  const url = useMemo(() => (v.blob ? URL.createObjectURL(v.blob) : v.remoteUrl ?? null), [v.blob, v.remoteUrl]);
  useEffect(() => () => {
    if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
  }, [url]);
  return (
    <div className="card overflow-hidden">
      <div className="relative aspect-video bg-panel">
        {v.status === "succeeded" && url ? (
          <video src={url} controls playsInline className="h-full w-full" />
        ) : (
          <div className="absolute inset-0 grid place-items-center p-4 text-center text-panel-ink">
            {v.status === "failed" ? (
              <span className="text-[13px] text-[#ff8b80]">{v.error ?? "Failed"} — credits refunded</span>
            ) : (
              <div className="w-full max-w-[240px]">
                <div className="flex justify-between font-mono text-[11px] text-panel-dim">
                  <span>{v.status === "queued" ? "Queued" : "Generating"}</span>
                  <span>{v.progress != null ? `${v.progress}%` : ""}</span>
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/15">
                  <div className={v.progress == null ? "shimmer h-full w-full opacity-40" : "h-full bg-white transition-all"} style={v.progress != null ? { width: `${v.progress}%` } : undefined} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 p-3 text-[12.5px]">
        <span className="line-clamp-1 flex-1 text-ink-2">{v.prompt}</span>
        <span className="font-mono text-[11px] text-dim">
          {v.durationSec}s · {v.resolution}
        </span>
        {url && v.status === "succeeded" ? (
          <a href={url} download={`video-${v.id.slice(0, 8)}.mp4`} className="rounded p-1 text-dim hover:text-ink" aria-label="Download">
            <Download size={14} />
          </a>
        ) : null}
        <button onClick={() => deleteVideo(v.id)} className="rounded p-1 text-dim hover:text-danger" aria-label="Delete">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

export function VideoStudio() {
  const { models } = useModels();
  const { account, refresh } = useAccount();
  const { value: videos } = useLive("videos", listVideos, [] as StoredVideo[]);
  const videoModels = models?.video ?? [];
  const [modelId, setModelId] = useState("");
  const model = videoModels.find((m) => m.id === modelId) ?? videoModels.find((m) => m.available) ?? videoModels[0];
  const [prompt, setPrompt] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [resolution, setResolution] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dur = model && duration && model.durations.includes(duration) ? duration : model?.durations[0];
  const res = model && resolution && model.resolutions.includes(resolution) ? resolution : model?.resolutions[0];

  // Poll active jobs; when one finishes, keep a copy of the file in this browser.
  useEffect(() => {
    const active = videos.filter((v) => v.status === "queued" || v.status === "running");
    if (!active.length) return;
    const t = setInterval(async () => {
      for (const v of active) {
        try {
          const s = await apiJson<{ status: StoredVideo["status"]; progress: number | null; url: string | null; error: string | null; refunded: boolean }>("/api/video/status", { method: "POST", json: { job: v.job } });
          const next: StoredVideo = { ...v, status: s.status, progress: s.progress, error: s.error ?? undefined, remoteUrl: s.url ?? undefined };
          if (s.status === "succeeded" && s.url) {
            next.blob = await fetch(s.url).then((r) => (r.ok ? r.blob() : undefined)).catch(() => undefined);
          }
          if (s.refunded || s.status === "succeeded") refresh();
          await putVideo(next);
        } catch {}
      }
    }, 4000);
    return () => clearInterval(t);
  }, [videos, refresh]);

  async function onImage(f: File) {
    setErr(null);
    if (f.size > 6 * 1024 * 1024) return setErr("Start image must be 6 MB or smaller.");
    const head = new Uint8Array(await f.slice(0, 16).arrayBuffer());
    if (!sniffImageMime(head)) return setErr("Start image must be PNG, JPEG, WEBP or GIF.");
    const r = new FileReader();
    r.onload = () => setImage(r.result as string);
    r.readAsDataURL(f);
  }

  async function generate() {
    if (!model || !prompt.trim() || !dur || !res) return;
    setBusy(true);
    setErr(null);
    try {
      const sent = sanitizePrompt(prompt, "smart").sanitized;
      const r = await apiJson<{ job: string; credits: number }>("/api/video", { method: "POST", json: { model: model.id, prompt: sent, durationSec: dur, resolution: res, ...(image ? { image } : {}) } });
      await putVideo({ id: uid(), createdAt: Date.now(), prompt, model: model.id, durationSec: dur, resolution: res, job: r.job, status: "queued", progress: null });
      setPrompt("");
      setImage(null);
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
        <PageHeader icon={Film} title="Video" description="Text-to-video and image-to-video. Credits are charged when a job starts and refunded automatically if it fails. Finished clips are copied into this browser." />
        <div className="card p-4 sm:p-5">
          <div className="flex gap-3">
            {image ? (
              <div className="relative shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image} alt="Start frame" className="h-20 w-20 rounded-lg object-cover" />
                <button onClick={() => setImage(null)} className="absolute -top-2 -right-2 rounded-full border border-line bg-surface p-0.5" aria-label="Remove start image">
                  <X size={12} />
                </button>
              </div>
            ) : null}
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} placeholder="Slow dolly across a rain-soaked street at night, neon reflections…" aria-label="Video prompt" className="min-w-0 flex-1 resize-none bg-transparent text-[15px] leading-relaxed outline-none placeholder:text-dim" />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line-2 pt-4">
            <select value={model?.id ?? ""} onChange={(e) => setModelId(e.target.value)} aria-label="Video model" className="h-8 rounded-full border border-line bg-surface px-3 text-[12.5px] outline-none">
              {videoModels.filter((m) => m.available).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
            {model ? <Segmented ariaLabel="Duration" size="sm" value={String(dur)} onChange={(v) => setDuration(Number(v))} options={model.durations.map((d) => ({ value: String(d), label: `${d}s` }))} /> : null}
            {model ? <Segmented ariaLabel="Resolution" size="sm" value={res ?? ""} onChange={setResolution} options={model.resolutions.map((r) => ({ value: r, label: r }))} /> : null}
            <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()} disabled={!model?.imageToVideo}>
              <ImagePlus size={14} /> Start image
            </Button>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => e.target.files?.[0] && onImage(e.target.files[0])} />
            <Button className="ml-auto" onClick={generate} disabled={busy || !prompt.trim() || !model?.available || !account}>
              {busy ? <Spinner /> : null} Generate
            </Button>
          </div>
          {model ? <p className="mt-3 text-[12px] text-dim">≈ ${(model.unitUsdPerSecond * (dur ?? 0)).toFixed(2)} provider cost before markup · {image ? "Image → video" : "Text → video"}</p> : null}
          {!account ? (
            <p className="mt-2 text-[12.5px] text-dim">
              Video uses credits. <Link href="/app/credits" className="underline">Add credits</Link>.
            </p>
          ) : null}
          {models && !videoModels.some((m) => m.available) ? <p className="mt-3 text-[12.5px] text-dim">Video generation is coming soon.</p> : null}
          {err ? <p className="mt-3 text-[13px] text-danger">{err}</p> : null}
        </div>

        <h2 className="eyebrow mt-8">On this device · {videos.length}</h2>
        {videos.length === 0 ? <p className="mt-3 text-[13.5px] text-dim">No videos yet.</p> : null}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {videos.map((v) => (
            <VideoCard key={v.id} v={v} />
          ))}
        </div>
      </div>
    </div>
  );
}
