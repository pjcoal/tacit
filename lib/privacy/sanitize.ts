import { detectEntities } from "./detectors";
import type { EntityType, PlaceholderMap, PrivacyMode, Replacement, SanitizeResult } from "./types";

export const PLACEHOLDER_TYPES: EntityType[] = [
  "PERSON", "NAME", "CITY", "PLACE", "COUNTRY", "ADDRESS", "POSTCODE", "EMAIL", "PHONE", "URL", "IP", "CARD", "IBAN",
  "ID", "WALLET", "TX", "SECRET", "ORG", "DATE", "NUM", "HANDLE",
];

/** Matches placeholders this module produces, e.g. "[PERSON_1]". */
export const PLACEHOLDER_RE = new RegExp(`\\[(?:${PLACEHOLDER_TYPES.join("|")})_\\d+\\]`, "g");

export function createPlaceholderMap(): PlaceholderMap {
  return { version: 1, byPlaceholder: {}, byValue: {}, counters: {} };
}

function normalizeValue(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function clone(map: PlaceholderMap): PlaceholderMap {
  return {
    version: 1,
    byPlaceholder: { ...map.byPlaceholder },
    byValue: { ...map.byValue },
    counters: { ...map.counters },
  };
}

function placeholderFor(map: PlaceholderMap, type: EntityType, value: string): string {
  const key = normalizeValue(value);
  const existing = map.byValue[key];
  if (existing) return existing;
  const n = (map.counters[type] ?? 0) + 1;
  map.counters[type] = n;
  const placeholder = `[${type}_${n}]`;
  map.byPlaceholder[placeholder] = { type, value: value.trim() };
  map.byValue[key] = placeholder;
  return placeholder;
}

/**
 * Replace sensitive spans with stable placeholders.
 *
 * - The same value always maps to the same placeholder within a conversation
 *   (the map is passed in and an updated copy is returned).
 * - Secrets (recovery phrases, private keys, API tokens) are removed in every
 *   mode, including Off, because nothing good comes from sending them anywhere.
 * - Existing placeholders in the input are left untouched.
 */
export function sanitizePrompt(text: string, mode: PrivacyMode, map: PlaceholderMap = createPlaceholderMap()): SanitizeResult {
  const next = clone(map);

  // Protect placeholders already present (e.g. when re-sanitizing restored history).
  const protectedRanges: Array<[number, number]> = [];
  for (const m of text.matchAll(PLACEHOLDER_RE)) protectedRanges.push([m.index!, m.index! + m[0].length]);

  const entities = detectEntities(text, mode).filter(
    (e) => !protectedRanges.some(([a, b]) => e.start < b && a < e.end),
  );

  const replacements: Replacement[] = [];
  const seen = new Set<string>();
  let out = "";
  let cursor = 0;
  for (const e of entities) {
    const placeholder = placeholderFor(next, e.type, e.value);
    out += text.slice(cursor, e.start) + placeholder;
    cursor = e.end;
    if (!seen.has(placeholder)) {
      seen.add(placeholder);
      replacements.push({ placeholder, type: next.byPlaceholder[placeholder].type, value: e.value });
    }
  }
  out += text.slice(cursor);

  const warnings: string[] = [];
  if (entities.some((e) => e.type === "SECRET")) {
    warnings.push(
      "Something that looks like a private key, recovery phrase or API token was removed. Never share these with anyone, including AI models.",
    );
  }
  if (mode === "off" && text.trim()) {
    warnings.push("Privacy filtering is off: apart from secrets, this message is sent exactly as written.");
  }

  return { mode, original: text, sanitized: out, replacements, warnings, map: next };
}
