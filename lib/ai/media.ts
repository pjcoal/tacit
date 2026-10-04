import "server-only";
import { env } from "@/server/env";
import { compatEndpoint } from "./providers/openai-compatible";
import { ProviderError, type ImageModelSpec, type VideoModelSpec } from "./types";

export interface GeneratedImage {
  mime: string;
  b64: string;
}

const OPENAI_SIZES: Record<string, string> = { "1:1": "1024x1024", "3:2": "1536x1024", "2:3": "1024x1536" };
const FLUX_DIMS: Record<string, [number, number]> = {
  "1:1": [1024, 1024],
  "3:2": [1152, 768],
  "2:3": [768, 1152],
  "16:9": [1344, 768],
  "9:16": [768, 1344],
};

// Provider output is only ever fetched from these hosts (no user-controlled URLs → no SSRF).
const OUTPUT_HOSTS = new Set(["replicate.delivery", "pbxt.replicate.delivery"]);
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

async function fetchProviderAsset(url: string, signal: AbortSignal): Promise<GeneratedImage> {
  const u = new URL(url);
  if (u.protocol !== "https:" || ![...OUTPUT_HOSTS].some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`))) {
    throw new ProviderError("Unexpected provider output location");
  }
  const res = await fetch(u, { signal });
  if (!res.ok) throw new ProviderError(`Could not download generated image (${res.status})`);
  const mime = res.headers.get("content-type")?.split(";")[0] ?? "image/png";
  if (!/^image\/(png|jpeg|webp)$/.test(mime)) throw new ProviderError("Provider returned an unexpected file type");
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > MAX_IMAGE_BYTES) throw new ProviderError("Generated image is too large");
  return { mime, b64: buf.toString("base64") };
}

function replicateToken(): string {
  const t = env().REPLICATE_API_TOKEN;
  if (!t) throw new ProviderError("Replicate is not configured", 503, "provider_not_configured");
  return t;
}

async function replicateFetch(path: string, init: RequestInit = {}) {
  const res = await fetch(`https://api.replicate.com/v1${path}`, {
    ...init,
    headers: { authorization: `Bearer ${replicateToken()}`, "content-type": "application/json", ...init.headers },
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new ProviderError(`Replicate returned ${res.status}: ${String(json.detail ?? json.title ?? "").slice(0, 200)}`, res.status === 429 ? 429 : 502);
  }
  return json;
}

export async function generateImage(
  model: ImageModelSpec,
  req: { prompt: string; aspectRatio: string; quality?: string },
  signal: AbortSignal,
): Promise<GeneratedImage> {
  if (model.provider === "openai" || model.provider === "together") {
    const ep = compatEndpoint(model.provider);
    const body: Record<string, unknown> =
      model.provider === "openai"
        ? { model: model.upstream, prompt: req.prompt, n: 1, size: OPENAI_SIZES[req.aspectRatio] ?? "1024x1024", quality: req.quality ?? "medium" }
        : (() => {
            const [width, height] = FLUX_DIMS[req.aspectRatio] ?? FLUX_DIMS["1:1"];
            return { model: model.upstream, prompt: req.prompt, n: 1, width, height, steps: 4, response_format: "base64" };
          })();
    const res = await fetch(`${ep.baseUrl}/images/generations`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${ep.apiKey}` },
      body: JSON.stringify(body),
      signal,
    });
    const json = (await res.json().catch(() => ({}))) as { data?: Array<{ b64_json?: string }>; error?: { message?: string } };
    if (!res.ok) throw new ProviderError(`${model.provider} image error: ${json.error?.message ?? res.status}`, res.status === 429 ? 429 : 502);
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) throw new ProviderError("The provider returned no image");
    return { mime: "image/png", b64 };
  }

  // Replicate: synchronous prediction (Prefer: wait).
  const prediction = await replicateFetch(`/models/${model.upstream}/predictions`, {
    method: "POST",
    headers: { Prefer: "wait=60" },
    body: JSON.stringify({ input: { prompt: req.prompt, aspect_ratio: req.aspectRatio, output_format: "png" } }),
    signal,
  });
  if (prediction.status === "failed") throw new ProviderError(`Generation failed: ${String(prediction.error ?? "unknown error")}`);
  const output = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
  if (typeof output !== "string") throw new ProviderError("The image is still processing; try again in a moment.", 504);
  return fetchProviderAsset(output, signal);
}

export interface VideoJobStatus {
  status: "queued" | "running" | "succeeded" | "failed";
  progress: number | null;
  url: string | null;
  error: string | null;
}

export async function startVideo(
  model: VideoModelSpec,
  req: { prompt: string; durationSec: number; resolution: string; imageDataUrl?: string },
): Promise<string> {
  const prediction = await replicateFetch(`/models/${model.upstream}/predictions`, {
    method: "POST",
    body: JSON.stringify({ input: model.buildInput(req) }),
  });
  const id = String(prediction.id ?? "");
  if (!/^[a-z0-9]{10,64}$/i.test(id)) throw new ProviderError("Provider returned an invalid job id");
  return id;
}

export async function getVideoStatus(jobId: string): Promise<VideoJobStatus> {
  if (!/^[a-z0-9]{10,64}$/i.test(jobId)) throw new ProviderError("Invalid job id", 400);
  const p = await replicateFetch(`/predictions/${jobId}`);
  const status = String(p.status);
  const logs = typeof p.logs === "string" ? p.logs : "";
  const pct = [...logs.matchAll(/(\d{1,3})%/g)].map((m) => Number(m[1])).filter((n) => n <= 100).pop();
  const output = Array.isArray(p.output) ? p.output[0] : p.output;
  let url: string | null = null;
  if (typeof output === "string") {
    const u = new URL(output);
    if (u.protocol === "https:" && [...OUTPUT_HOSTS].some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`))) url = u.toString();
  }
  return {
    status: status === "succeeded" ? "succeeded" : status === "failed" || status === "canceled" ? "failed" : status === "starting" ? "queued" : "running",
    progress: status === "succeeded" ? 100 : (pct ?? null),
    url,
    error: status === "failed" || status === "canceled" ? String(p.error ?? "Generation failed") : null,
  };
}
