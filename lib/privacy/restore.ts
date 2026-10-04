import { PLACEHOLDER_RE, PLACEHOLDER_TYPES } from "./sanitize";
import type { PlaceholderMap } from "./types";

// Models occasionally drop the brackets ("PERSON_1"); restore those only when the token is known.
const BARE_RE = new RegExp(`(?<![\\w\\[])(?:${PLACEHOLDER_TYPES.join("|")})_\\d+(?![\\w\\]])`, "g");

/** Swap placeholders in a model response back to the original values. Runs in the browser. */
export function restoreResponse(text: string, map: PlaceholderMap): string {
  if (!text) return text;
  return text
    .replace(PLACEHOLDER_RE, (m) => map.byPlaceholder[m]?.value ?? m)
    .replace(BARE_RE, (m) => map.byPlaceholder[`[${m}]`]?.value ?? m);
}

/**
 * For streaming: restore what has arrived so far and hide a trailing,
 * not-yet-complete placeholder ("…send it to [PERS") until it finishes.
 */
export function restorePartial(text: string, map: PlaceholderMap): string {
  const restored = restoreResponse(text, map);
  return restored.replace(/\[[A-Z_]*\d*$/, "");
}

/** Restore placeholders inside arbitrary JSON-like values (e.g. tool-call arguments). */
export function restoreDeep<T>(value: T, map: PlaceholderMap): T {
  if (typeof value === "string") return restoreResponse(value, map) as T;
  if (Array.isArray(value)) return value.map((v) => restoreDeep(v, map)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, restoreDeep(v, map)])) as T;
  }
  return value;
}

/** Placeholders the model used that this conversation's map knows about. */
export function usedPlaceholders(text: string, map: PlaceholderMap): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(PLACEHOLDER_RE)) if (map.byPlaceholder[m[0]]) found.add(m[0]);
  return [...found];
}
