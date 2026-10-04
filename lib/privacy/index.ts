export { sanitizePrompt, createPlaceholderMap, PLACEHOLDER_RE } from "./sanitize";
export { restoreResponse, restorePartial, restoreDeep, usedPlaceholders } from "./restore";
export { sendSanitizedPrompt, readEventStream } from "./pipeline";
export { detectEntities } from "./detectors";
export type * from "./types";

export const PRIVACY_MODE_INFO = {
  smart: {
    label: "Smart",
    short: "Replaces names, places, contact details, IDs, addresses and wallets with placeholders.",
  },
  strict: {
    label: "Strict",
    short: "Also replaces every other proper noun, number of 3+ digits, date, URL and country. Answers may get vaguer.",
  },
  off: {
    label: "Off",
    short: "Sends your text as written. Secrets such as recovery phrases are still removed.",
  },
} as const;
