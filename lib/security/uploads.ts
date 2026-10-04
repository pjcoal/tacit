/** Attachment limits and MIME sniffing shared by client (early feedback) and server (enforcement). */

export const IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
export type ImageMime = (typeof IMAGE_MIME_TYPES)[number];

export const TEXT_EXTENSIONS = [
  "txt", "md", "csv", "json", "yaml", "yml", "toml", "xml", "html", "css", "js", "jsx", "ts", "tsx", "py", "rs", "go",
  "java", "rb", "php", "c", "h", "cpp", "sh", "sql", "sol", "log",
];

export const LIMITS = {
  maxImagesPerMessage: 4,
  maxImageBytes: 5 * 1024 * 1024,
  maxTextFileBytes: 256 * 1024,
  maxTextFilesPerMessage: 5,
  maxMessageChars: 200_000,
  maxMessages: 200,
};

/** Detect an image type from its first bytes. */
export function sniffImageMime(bytes: Uint8Array): ImageMime | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return "image/gif";
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

function base64Head(b64: string, bytes: number): Uint8Array {
  const chars = Math.ceil((bytes * 4) / 3 / 4) * 4;
  const head = b64.slice(0, chars);
  const bin = atob(head);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function base64ByteLength(b64: string): number {
  const pad = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - pad;
}

/** Throws when the declared MIME doesn't match the content, or limits are exceeded. */
export function validateImageBase64(declared: string, b64: string, maxBytes = LIMITS.maxImageBytes): ImageMime {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) throw new Error("Image is not valid base64");
  if (base64ByteLength(b64) > maxBytes) throw new Error(`Image exceeds ${Math.round(maxBytes / 1024 / 1024)} MB`);
  const sniffed = sniffImageMime(base64Head(b64, 16));
  if (!sniffed) throw new Error("Unsupported image format");
  if (sniffed !== declared) throw new Error(`Image content (${sniffed}) does not match declared type (${declared})`);
  return sniffed;
}

/** Data URL → validated parts. */
export function parseImageDataUrl(dataUrl: string, maxBytes = LIMITS.maxImageBytes) {
  const m = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!m) throw new Error("Expected a base64 image data URL");
  const mime = validateImageBase64(m[1], m[2], maxBytes);
  return { mime, data: m[2] };
}
