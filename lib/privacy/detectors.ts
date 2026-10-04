import { wordlist as BIP39_ENGLISH } from "@scure/bip39/wordlists/english.js";
import { isBase58PublicKey, isBase58Signature64 } from "@/lib/solana/address";
import {
  AMBIGUOUS_NAMES,
  CITIES,
  COMMON_CAPITALIZED,
  COUNTRIES,
  FIRST_NAMES,
  ORG_SUFFIXES,
  PERSON_RELATIONS,
  STREET_SUFFIXES,
} from "./dictionaries";
import type { DetectedEntity, EntityType, PrivacyMode } from "./types";

/**
 * Heuristic, dependency-free entity detection that runs in the browser.
 * Structured identifiers (emails, keys, cards, wallets…) use validated
 * patterns; names and places use cues + compact dictionaries. It will miss
 * things — the privacy receipt shows exactly what was and wasn't replaced.
 */

const BIP39 = new Set(BIP39_ENGLISH);

// A capitalized word: "Alice", "O'Neill", "McDonald", "Jean-Luc".
// Possessive "'s" is excluded so "Alice's" yields "Alice".
const CAP_WORD = String.raw`(?:\p{Lu}[\p{L}\-]*(?:['’](?!s(?![\p{L}]))\p{L}+)?)`;
const CAP_SEQ = (max: number) => `${CAP_WORD}(?:\\s+${CAP_WORD}){0,${max - 1}}`;

/** Case-insensitive source for a literal cue while keeping the rest of the regex case-sensitive. */
function ci(literal: string): string {
  return literal
    .split("")
    .map((ch) => {
      if (/[a-z]/i.test(ch)) return `[${ch.toLowerCase()}${ch.toUpperCase()}]`;
      if (ch === " ") return "\\s+";
      return ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("");
}
const cueGroup = (cues: string[]) => `(?:${cues.map(ci).join("|")})`;

const isCommon = (w: string) => COMMON_CAPITALIZED.has(w.toLowerCase().replace(/[’']s$/, ""));
const isKnownFirstName = (w: string) => FIRST_NAMES.has(w.toLowerCase());
const isAmbiguousName = (w: string) => AMBIGUOUS_NAMES.has(w.toLowerCase());
const isCity = (phrase: string) => CITIES.has(phrase.toLowerCase().replace(/\s+/g, "-"));
const isCountry = (phrase: string) => COUNTRIES.has(phrase.toLowerCase().replace(/\s+/g, "-"));

function luhn(digits: string): boolean {
  let sum = 0;
  let dbl = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

function ibanValid(raw: string): boolean {
  const iban = raw.replace(/\s+/g, "").toUpperCase();
  if (iban.length < 15 || iban.length > 34) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const code = ch.charCodeAt(0);
    const chunk = code >= 65 && code <= 90 ? String(code - 55) : ch;
    for (const c of chunk) remainder = (remainder * 10 + (c.charCodeAt(0) - 48)) % 97;
  }
  return remainder === 1;
}

function isSentenceStart(text: string, index: number): boolean {
  let i = index - 1;
  while (i >= 0 && /[\s"'“‘(]/.test(text[i])) {
    if (text[i] === "\n") return true;
    i--;
  }
  return i < 0 || /[.!?:]/.test(text[i]);
}

function contextBefore(text: string, index: number, chars: number): string {
  return text.slice(Math.max(0, index - chars), index).toLowerCase();
}

/** Ranges of fenced (```) and inline (`) code. Name heuristics are skipped inside code. */
export function findCodeRanges(text: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const fence = /```[\s\S]*?(?:```|$)/g;
  for (const m of text.matchAll(fence)) ranges.push([m.index!, m.index! + m[0].length]);
  const inline = /`[^`\n]+`/g;
  for (const m of text.matchAll(inline)) {
    const s = m.index!;
    if (!ranges.some(([a, b]) => s >= a && s < b)) ranges.push([s, s + m[0].length]);
  }
  return ranges;
}

interface Ctx {
  text: string;
  mode: Exclude<PrivacyMode, "off">;
  out: DetectedEntity[];
  code: Array<[number, number]>;
}

function push(ctx: Ctx, type: EntityType, start: number, end: number, priority: number) {
  if (end <= start) return;
  ctx.out.push({ type, start, end, value: ctx.text.slice(start, end), priority });
}

function inCode(ctx: Ctx, start: number) {
  return ctx.code.some(([a, b]) => start >= a && start < b);
}

function each(re: RegExp, text: string, fn: (m: RegExpExecArray) => void) {
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    fn(m);
    if (m[0].length === 0) re.lastIndex++;
  }
}

/** Index of capture group `g` inside the full match. */
function groupStart(m: RegExpExecArray, g: number): number {
  const full = m[0];
  const sub = m[g];
  return m.index + full.lastIndexOf(sub);
}

// ---------------------------------------------------------------------------
// Secrets — always detected, in every mode (including Off).
// ---------------------------------------------------------------------------

export function detectSecrets(text: string): DetectedEntity[] {
  const ctx: Ctx = { text, mode: "smart", out: [], code: [] };
  const P = 100;

  each(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, text, (m) =>
    push(ctx, "SECRET", m.index, m.index + m[0].length, P),
  );
  const tokenPatterns = [
    /\bsk-(?:ant-|proj-|or-v1-|or-)?[A-Za-z0-9_-]{20,}/g,
    /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g,
    /\bgithub_pat_[A-Za-z0-9_]{40,}\b/g,
    /\bAKIA[0-9A-Z]{16}\b/g,
    /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g,
    /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g,
    /\bAIza[0-9A-Za-z_-]{35}\b/g,
    /\br8_[A-Za-z0-9]{30,}\b/g,
    /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/g, // Stripe
    /\bwhsec_[A-Za-z0-9+/=]{20,}/g, // webhook signing secrets
    /\bnpm_[A-Za-z0-9]{36}\b/g,
    /\bhf_[A-Za-z0-9]{30,}\b/g,
    /\bSG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}/g, // SendGrid
    /\bGOCSPX-[A-Za-z0-9_-]{20,}/g, // Google OAuth client secret
    /\bsb_secret_[A-Za-z0-9_-]{20,}/g, // Supabase
    /\bveil_(?:sk|acct)_[A-Za-z0-9_-]{43}\b/g, // our own API and account keys
  ];
  for (const re of tokenPatterns) each(re, text, (m) => push(ctx, "SECRET", m.index, m.index + m[0].length, P));

  // .env-style assignments: STRIPE_SECRET=…, API_KEY: "…". Only the value is replaced.
  each(/\b[A-Z][A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|PASSWD|API_KEY|PRIVATE_KEY)[A-Z0-9_]*\s*[=:]\s*["']?([^\s"'`]{8,})/g, text, (m) => {
    const s = groupStart(m, 1);
    push(ctx, "SECRET", s, s + m[1].length, P);
  });
  // Passwords inside database / broker connection strings.
  each(/\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|rediss?|amqps?):\/\/[^\s:@/]+:([^\s@/]+)@/g, text, (m) => {
    const s = groupStart(m, 1);
    push(ctx, "SECRET", s, s + m[1].length, P);
  });

  // Solana keypair file: a JSON array of 64 bytes.
  each(/\[\s*(?:\d{1,3}\s*,\s*){63}\d{1,3}\s*\]/g, text, (m) =>
    push(ctx, "SECRET", m.index, m.index + m[0].length, P),
  );

  // 64-byte base58 values are either transaction signatures or secret keys.
  each(/\b[1-9A-HJ-NP-Za-km-z]{80,90}\b/g, text, (m) => {
    if (!isBase58Signature64(m[0])) return;
    const before = contextBefore(text, m.index, 48);
    const looksLikeTx = /(tx|txn|transaction|signature|sig|solscan|explorer|\/tx\/)\W*$/.test(before) ||
      /(tx|txn|transaction|signature|sig)\b/.test(before);
    if (!looksLikeTx) push(ctx, "SECRET", m.index, m.index + m[0].length, P);
  });

  // 32-byte hex near key-ish words (EVM private keys etc.).
  each(/\b(?:0x)?[a-fA-F0-9]{64}\b/g, text, (m) => {
    if (/(private|secret|priv|seed|mnemonic|key)\b[^\n]{0,24}$/.test(contextBefore(text, m.index, 40))) {
      push(ctx, "SECRET", m.index, m.index + m[0].length, P);
    }
  });

  // Recovery phrases: 12+ consecutive BIP-39 words (optionally numbered).
  const words = [...text.matchAll(/[a-z]+/g)];
  let run: RegExpMatchArray[] = [];
  const flush = () => {
    if (run.length >= 12) {
      // Valid mnemonic lengths are 12/15/18/21/24 words; don't swallow trailing ordinary words.
      const len = [24, 21, 18, 15, 12].find((n) => n <= run.length)!;
      const first = run[0];
      const last = run[len - 1];
      push(ctx, "SECRET", first.index!, last.index! + last[0].length, P);
    }
    run = [];
  };
  for (const w of words) {
    const prev = run[run.length - 1];
    const gapOk = !prev || /^[\s\d.,)\-:]*$/.test(text.slice(prev.index! + prev[0].length, w.index!));
    if (BIP39.has(w[0]) && gapOk) run.push(w);
    else {
      flush();
      if (BIP39.has(w[0])) run.push(w);
    }
  }
  flush();
  return ctx.out;
}

// ---------------------------------------------------------------------------
// Structured identifiers
// ---------------------------------------------------------------------------

const DATE_EXPR = String.raw`(?:\d{4}-\d{2}-\d{2}|\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}|\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?,?\s+\d{4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4})`;

function detectStructured(ctx: Ctx) {
  const { text, mode } = ctx;

  each(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, text, (m) =>
    push(ctx, "EMAIL", m.index, m.index + m[0].length, 90),
  );

  each(/\bhttps?:\/\/[^\s<>"'`)\]]+/gi, text, (m) => {
    const url = m[0].replace(/[.,;:!?]+$/, "");
    const identifying =
      /[?#]/.test(url) ||
      /@/.test(url) ||
      /\/[A-Za-z0-9_-]{16,}(\/|$)/.test(url) ||
      /\/(u|user|users|profile|profiles|in|people|@[^/]+)\//i.test(url + "/");
    if (mode === "strict" || identifying) push(ctx, "URL", m.index, m.index + url.length, 85);
  });
  if (mode === "strict") {
    each(/\bwww\.[^\s<>"'`)\]]+/gi, text, (m) => {
      const url = m[0].replace(/[.,;:!?]+$/, "");
      push(ctx, "URL", m.index, m.index + url.length, 85);
    });
  }

  each(/\b(?:\d[ -]?){12,18}\d\b/g, text, (m) => {
    const digits = m[0].replace(/\D/g, "");
    if (digits.length >= 13 && digits.length <= 19 && luhn(digits)) push(ctx, "CARD", m.index, m.index + m[0].length, 85);
  });

  each(/\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]){11,30}\b/g, text, (m) => {
    if (ibanValid(m[0])) push(ctx, "IBAN", m.index, m.index + m[0].length, 85);
  });

  // Wallet / account addresses.
  each(/\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g, text, (m) => {
    if (isBase58PublicKey(m[0])) push(ctx, "WALLET", m.index, m.index + m[0].length, 80);
  });
  each(/\b0x[a-fA-F0-9]{40}\b/g, text, (m) => push(ctx, "WALLET", m.index, m.index + m[0].length, 80));
  each(/\b(?:bc1[a-z0-9]{25,59}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})\b/g, text, (m) => {
    if (m[0].startsWith("bc1") || /\d/.test(m[0])) push(ctx, "WALLET", m.index, m.index + m[0].length, 79);
  });

  // Transaction signatures (secrets of the same shape are claimed by detectSecrets at higher priority).
  each(/\b[1-9A-HJ-NP-Za-km-z]{80,90}\b/g, text, (m) => {
    if (isBase58Signature64(m[0])) push(ctx, "TX", m.index, m.index + m[0].length, 80);
  });
  each(/\b0x[a-fA-F0-9]{64}\b/g, text, (m) => push(ctx, "TX", m.index, m.index + m[0].length, 78));

  each(/\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g, text, (m) =>
    push(ctx, "IP", m.index, m.index + m[0].length, 75),
  );
  each(/\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g, text, (m) => push(ctx, "IP", m.index, m.index + m[0].length, 75));

  // Government identifiers: US SSN, Irish PPSN, UK National Insurance number.
  each(/\b\d{3}-\d{2}-\d{4}\b/g, text, (m) => push(ctx, "ID", m.index, m.index + m[0].length, 80));
  each(/\b\d{7}[A-W][A-IW]?\b/g, text, (m) => push(ctx, "ID", m.index, m.index + m[0].length, 80));
  each(/\b[A-CEGHJ-PR-TW-Z]{2} ?\d{2} ?\d{2} ?\d{2} ?[A-D]\b/g, text, (m) => push(ctx, "ID", m.index, m.index + m[0].length, 80));
  each(new RegExp(`${ci("passport")}(?:\\s+(?:no\\.?|number|#))?[:\\s]+([A-Z0-9]{6,9})\\b`, "g"), text, (m) => {
    const s = groupStart(m, 1);
    push(ctx, "ID", s, s + m[1].length, 80);
  });

  // Phone numbers.
  each(/(?<![\w+])(?:\+\d{1,3}[\s.-]?)?(?:\(\d{1,4}\)[\s.-]?)?\d{2,4}(?:[\s.-]?\d{2,4}){1,4}(?![\w])/g, text, (m) => {
    const raw = m[0].trim();
    const digits = raw.replace(/\D/g, "");
    if (digits.length < 7 || digits.length > 15) return;
    if (/^\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}$/.test(raw)) return; // date
    if (/^\d+\.\d+$/.test(raw)) return; // decimal
    const hasSeparators = /[\s.\-()]/.test(raw);
    const context = /(phone|call|text|mobile|cell|tel|whatsapp|number|ring|sms|contact)\b[^\n]{0,20}$/.test(
      contextBefore(text, m.index, 32),
    );
    const plausible =
      raw.startsWith("+") ||
      context ||
      (hasSeparators && digits.length >= 9) ||
      (/^0\d/.test(digits) && digits.length >= 9 && digits.length <= 11);
    if (plausible) push(ctx, "PHONE", m.index, m.index + m[0].length, 70);
  });

  // Postcodes: Irish Eircode, UK postcode; US ZIP with context (or Strict).
  each(/\b(?:[AC-FHKNPRTV-Y]\d{2}|D6W) ?[0-9AC-FHKNPRTV-Y]{4}\b/g, text, (m) =>
    push(ctx, "POSTCODE", m.index, m.index + m[0].length, 65),
  );
  each(/\b[A-PR-UWYZ][A-HK-Y]?\d[A-Z\d]? ?\d[ABD-HJLNP-UW-Z]{2}\b/g, text, (m) =>
    push(ctx, "POSTCODE", m.index, m.index + m[0].length, 65),
  );
  each(/\b\d{5}(?:-\d{4})?\b/g, text, (m) => {
    if (mode === "strict" || /(zip|postal|postcode)\b[^\n]{0,12}$/.test(contextBefore(text, m.index, 24))) {
      push(ctx, "POSTCODE", m.index, m.index + m[0].length, 65);
    }
  });

  // Street addresses.
  const suffix = `(?:${STREET_SUFFIXES.join("|")})`;
  each(new RegExp(`\\b\\d{1,5}[A-Za-z]?,?\\s+(?:${CAP_WORD}\\s+){0,3}${CAP_WORD}\\s+${suffix}\\b\\.?`, "gu"), text, (m) =>
    push(ctx, "ADDRESS", m.index, m.index + m[0].length, 66),
  );
  const longSuffix = "(?:Street|Road|Avenue|Lane|Boulevard|Drive|Terrace|Crescent|Close|Square|Gardens|Grove)";
  each(new RegExp(`(?:${CAP_WORD}\\s+){1,3}${longSuffix}\\b`, "gu"), text, (m) => {
    const firstWord = m[0].split(/\s+/)[0];
    if (!isCommon(firstWord)) push(ctx, "ADDRESS", m.index, m.index + m[0].length, 64);
  });
  each(/\b(?:Apartment|Apt|Flat|Unit|Suite)\.?\s*#?\d+[A-Za-z]?\b/g, text, (m) =>
    push(ctx, "ADDRESS", m.index, m.index + m[0].length, 66),
  );

  // Dates: birth dates always, any date in Strict.
  each(new RegExp(`${cueGroup(["born on", "born", "dob", "d.o.b.", "date of birth", "birthday is", "birthday"])}[:\\s]+(${DATE_EXPR})`, "g"), text, (m) => {
    const s = groupStart(m, 1);
    push(ctx, "DATE", s, s + m[1].length, 60);
  });
  if (mode === "strict") {
    each(new RegExp(DATE_EXPR, "g"), text, (m) => push(ctx, "DATE", m.index, m.index + m[0].length, 60));
  }

  // Social handles.
  each(/(?<![\w.@])@[A-Za-z0-9_]{2,30}\b/g, text, (m) => {
    if (!inCode(ctx, m.index)) push(ctx, "HANDLE", m.index, m.index + m[0].length, 55);
  });
}

// ---------------------------------------------------------------------------
// People, places, organisations
// ---------------------------------------------------------------------------

/** Extend a detected given name with a following surname-like capitalized word. */
function withSurname(text: string, start: number, end: number): number {
  const rest = text.slice(end);
  const m = new RegExp(`^\\s+(${CAP_WORD})`, "u").exec(rest);
  if (m && !isCommon(m[1]) && !isCity(m[1]) && !isCountry(m[1])) return end + m[0].length;
  return end;
}

const RELATION_WORDS = new Set(PERSON_RELATIONS);
function personCandidateOk(word: string): boolean {
  return !isCommon(word) && !isCity(word) && !isCountry(word) && !RELATION_WORDS.has(word.toLowerCase());
}

function detectPeople(ctx: Ctx) {
  const { text } = ctx;
  const P = 50;
  const add = (start: number, value: string, extend = true) => {
    if (inCode(ctx, start)) return;
    let end = start + value.length;
    if (extend) end = withSurname(text, start, end);
    push(ctx, "PERSON", start, end, P);
  };

  // Honorifics: keep the title, replace the name.
  each(new RegExp(`\\b(?:Mr|Mrs|Ms|Mx|Dr|Prof|Sir|Madam|Mme|Herr|Frau)\\.?\\s+(${CAP_SEQ(3)})`, "gu"), text, (m) =>
    add(groupStart(m, 1), m[1], false),
  );

  // Self-introductions and sign-offs.
  const selfCues = cueGroup(["my name is", "my name's", "name's", "i am", "i'm", "call me", "this is", "signed", "regards,", "cheers,", "thanks,", "best,", "sincerely,", "from:"]);
  each(new RegExp(`${selfCues}\\s+(${CAP_SEQ(3)})`, "gu"), text, (m) => {
    const first = m[1].split(/\s+/)[0];
    if (personCandidateOk(first)) add(groupStart(m, 1), m[1], false);
  });

  // "my sister Aoife", "my landlord, Mr…"
  const relations = cueGroup(PERSON_RELATIONS.map((r) => `my ${r}`).concat(PERSON_RELATIONS.map((r) => `our ${r}`)));
  each(new RegExp(`${relations}(?:,|\\s+(?:named|called|is))?\\s+(${CAP_WORD})`, "gu"), text, (m) => {
    if (personCandidateOk(m[1])) add(groupStart(m, 1), m[1]);
  });

  // Strong verb cues: "email Siobhan", "meet Tom", "Dear Ms…"
  const strong = cueGroup([
    "tell", "ask", "email", "e-mail", "text", "call", "message", "dm", "remind", "invite", "meet", "meeting with",
    "thank", "cc", "dear", "hi", "hey", "hello", "congratulate", "pay", "paid", "owe", "visit", "reply to",
    "forward to", "introduce", "hire", "fire", "date", "dating", "married to", "divorced",
  ]);
  each(new RegExp(`(?<![\\p{L}])${strong}\\s+(${CAP_WORD})`, "gu"), text, (m) => {
    if (personCandidateOk(m[1])) add(groupStart(m, 1), m[1]);
  });

  // Weak cues need a dictionary hit: "send it to Alice", "with Bob".
  const weak = cueGroup(["to", "with", "and", "for", "from", "by", "of", "about", "like", "than", "via"]);
  each(new RegExp(`(?<![\\p{L}])${weak}\\s+(${CAP_WORD})`, "gu"), text, (m) => {
    if (isKnownFirstName(m[1]) && !isAmbiguousName(m[1]) && personCandidateOk(m[1])) add(groupStart(m, 1), m[1]);
  });

  // Dictionary names anywhere ("Alice said…").
  each(new RegExp(`(?<![\\p{L}])(${CAP_WORD})(?![\\p{L}])`, "gu"), text, (m) => {
    const w = m[1];
    if (isKnownFirstName(w) && !isAmbiguousName(w) && personCandidateOk(w)) add(m.index, w);
  });
}

function buildPhraseRegex(entries: Set<string>): RegExp {
  const particles = new Set(["de", "del", "da", "do", "la", "le", "the", "of", "el"]);
  const alts = [...entries]
    .map((e) =>
      e
        .split("-")
        .map((w) => (particles.has(w) ? w : w[0].toUpperCase() + w.slice(1)))
        .join("[\\s-]+"),
    )
    .sort((a, b) => b.length - a.length);
  return new RegExp(`(?<![\\p{L}])(?:${alts.join("|")})(?![\\p{L}])`, "gu");
}
const CITY_RE = buildPhraseRegex(CITIES);
const COUNTRY_RE = buildPhraseRegex(COUNTRIES);

function detectPlaces(ctx: Ctx) {
  const { text, mode } = ctx;
  each(CITY_RE, text, (m) => {
    if (!inCode(ctx, m.index)) push(ctx, "CITY", m.index, m.index + m[0].length, 45);
  });
  if (mode === "strict") {
    each(COUNTRY_RE, text, (m) => {
      if (!inCode(ctx, m.index)) push(ctx, "COUNTRY", m.index, m.index + m[0].length, 44);
    });
  }
  const cues = cueGroup([
    "live in", "living in", "lives in", "home in", "house in", "based in", "moved to", "move to", "moving to",
    "located in", "grew up in", "born in", "staying in", "stay in", "my address is", "i'm in", "i am in",
    "currently in", "neighbourhood of", "neighborhood of", "town of", "village of", "suburb of",
  ]);
  each(new RegExp(`${cues}\\s+(${CAP_SEQ(3)})`, "gu"), text, (m) => {
    const s = groupStart(m, 1);
    const first = m[1].split(/\s+/)[0];
    if (inCode(ctx, s) || isCommon(first)) return;
    if (isCountry(m[1]) && mode !== "strict") return;
    push(ctx, isCity(m[1]) ? "CITY" : "PLACE", s, s + m[1].length, 46);
  });
}

function detectOrgs(ctx: Ctx) {
  const { text } = ctx;
  const suffix = `(?:${ORG_SUFFIXES.join("|")})`;
  each(new RegExp(`(?:${CAP_WORD}\\s+){1,4}${suffix}\\b\\.?`, "gu"), text, (m) => {
    const first = m[0].split(/\s+/)[0];
    if (!inCode(ctx, m.index) && !isCommon(first)) push(ctx, "ORG", m.index, m.index + m[0].length, 40);
  });
  each(new RegExp(`\\b(?:University|College|Bank|Hospital|School) of (?:the )?${CAP_SEQ(3)}`, "gu"), text, (m) => {
    if (!inCode(ctx, m.index)) push(ctx, "ORG", m.index, m.index + m[0].length, 41);
  });
  const cues = cueGroup([
    "i work at", "i work for", "work at", "works at", "working at", "work for", "works for", "employed at", "employed by",
    "my employer is", "my company is", "job at", "intern at", "interning at", "studying at", "study at", "student at",
    "i study at", "enrolled at", "contractor for", "consultant for",
  ]);
  each(new RegExp(`${cues}\\s+(${CAP_SEQ(4)})`, "gu"), text, (m) => {
    const s = groupStart(m, 1);
    if (!inCode(ctx, s) && !isCommon(m[1].split(/\s+/)[0])) push(ctx, "ORG", s, s + m[1].length, 42);
  });
}

/** Strict mode: any remaining proper noun and any number of 3+ digits. */
function detectStrictCatchAll(ctx: Ctx) {
  const { text } = ctx;
  each(/\b\d{1,3}(?:[,.]\d{3})+(?:\.\d+)?\b|\b\d{3,}(?:\.\d+)?\b/g, text, (m) => {
    if (!inCode(ctx, m.index)) push(ctx, "NUM", m.index, m.index + m[0].length, 20);
  });
  // Words glued to identifiers or file names (STRIPE_SECRET_KEY, Next.js) are code, not names.
  each(new RegExp(`(?<![\\p{L}\\p{N}_./-])${CAP_SEQ(4)}(?![\\p{L}\\p{N}_]|\\.\\p{L})`, "gu"), text, (m) => {
    if (inCode(ctx, m.index)) return;
    const words = [...m[0].matchAll(/\S+/g)].map((w) => ({ word: w[0], start: m.index + w.index! }));
    // Sentence-initial capitalization carries no signal; nor do function words ("The", "Dr").
    if (words.length && isSentenceStart(text, words[0].start)) words.shift();
    while (words.length && isCommon(words[0].word)) words.shift();
    while (words.length && isCommon(words[words.length - 1].word)) words.pop();
    if (!words.length) return;
    const start = words[0].start;
    const last = words[words.length - 1];
    push(ctx, "NAME", start, last.start + last.word.length, 15);
  });
}

/** Detect sensitive spans. Overlaps are resolved by priority, then length. */
export function detectEntities(text: string, mode: PrivacyMode): DetectedEntity[] {
  const secrets = detectSecrets(text);
  if (mode === "off") return resolveOverlaps(secrets);

  const ctx: Ctx = { text, mode, out: [...secrets], code: findCodeRanges(text) };
  detectStructured(ctx);
  detectPeople(ctx);
  detectPlaces(ctx);
  detectOrgs(ctx);
  if (mode === "strict") detectStrictCatchAll(ctx);
  return resolveOverlaps(ctx.out);
}

export function resolveOverlaps(entities: DetectedEntity[]): DetectedEntity[] {
  const sorted = [...entities].sort(
    (a, b) => b.priority - a.priority || b.end - b.start - (a.end - a.start) || a.start - b.start,
  );
  const accepted: DetectedEntity[] = [];
  for (const e of sorted) {
    if (accepted.some((a) => e.start < a.end && a.start < e.end)) continue;
    accepted.push(e);
  }
  return accepted.sort((a, b) => a.start - b.start);
}
