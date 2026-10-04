import { NextResponse } from "next/server";
import { z } from "zod";
import { LIMITS, sniffImageMime } from "@/lib/security/uploads";
import { requireAdmin } from "@/server/auth/admin";
import { env } from "@/server/env";
import { assertSameOrigin, HttpError, route } from "@/server/http";

export const runtime = "nodejs";

const fields = z.object({
  name: z.string().trim().min(1).max(32),
  symbol: z.string().trim().min(1).max(10),
  description: z.string().trim().max(1000).default(""),
  website: z.url().max(200).optional().or(z.literal("")),
  twitter: z.url().max(200).optional().or(z.literal("")),
  telegram: z.url().max(200).optional().or(z.literal("")),
});

async function pin(jwt: string, path: string, init: RequestInit) {
  const res = await fetch(`https://api.pinata.cloud${path}`, { ...init, headers: { authorization: `Bearer ${jwt}`, ...init.headers } });
  const json = (await res.json().catch(() => ({}))) as { IpfsHash?: string; error?: unknown };
  if (!res.ok || !json.IpfsHash) throw new HttpError(502, `IPFS upload failed (${res.status})`, "upload_failed");
  return `https://gateway.pinata.cloud/ipfs/${json.IpfsHash}`;
}

/** Upload image + metadata JSON to IPFS via Pinata (only when PINATA_JWT is configured). */
export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  requireAdmin(req);
  const jwt = env().PINATA_JWT;
  if (!jwt) throw new HttpError(503, "Metadata upload is not configured (set PINATA_JWT), or paste an existing metadata URI.", "not_configured");

  const form = await req.formData();
  const file = form.get("image");
  if (!(file instanceof File)) throw new HttpError(400, "Image is required", "invalid_request");
  if (file.size > LIMITS.maxImageBytes) throw new HttpError(413, "Image must be 5 MB or smaller", "payload_too_large");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = sniffImageMime(bytes);
  if (!mime) throw new HttpError(400, "Image must be PNG, JPEG, WEBP or GIF", "invalid_image");

  const meta = fields.parse(Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string")));
  const imageForm = new FormData();
  imageForm.append("file", new Blob([bytes], { type: mime }), `${meta.symbol.toLowerCase()}.${mime.split("/")[1]}`);
  const image = await pin(jwt, "/pinning/pinFileToIPFS", { method: "POST", body: imageForm });

  const metadata = {
    name: meta.name,
    symbol: meta.symbol,
    description: meta.description,
    image,
    showName: true,
    createdOn: env().NEXT_PUBLIC_APP_URL,
    ...(meta.website ? { website: meta.website } : {}),
    ...(meta.twitter ? { twitter: meta.twitter } : {}),
    ...(meta.telegram ? { telegram: meta.telegram } : {}),
  };
  const uri = await pin(jwt, "/pinning/pinJSONToIPFS", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ pinataContent: metadata, pinataMetadata: { name: `${meta.symbol}-metadata.json` } }),
  });
  return NextResponse.json({ uri, image, metadata });
});
