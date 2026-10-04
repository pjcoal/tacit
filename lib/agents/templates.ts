import type { PrivacyMode } from "@/lib/privacy/types";

export interface AgentDraft {
  name: string;
  description: string;
  instructions: string;
  starters: string[];
  privacyMode: PrivacyMode;
  solana: boolean;
}

export const BLANK_AGENT: AgentDraft = {
  name: "",
  description: "",
  instructions: "",
  starters: [],
  privacyMode: "smart",
  solana: false,
};

export const MAX_STARTERS = 4;

/** Starting points for builders. Users edit everything after picking one. */
export const AGENT_TEMPLATES: Array<AgentDraft & { id: string }> = [
  {
    id: "reviewer",
    name: "Code reviewer",
    description: "Reviews diffs for bugs, security holes and missing tests.",
    instructions: [
      "You are a senior engineer reviewing code before it ships.",
      "For every snippet or diff: list real bugs first, then security issues, then missing tests, then style nits last.",
      "Quote the exact line you're talking about and suggest a concrete fix as a code block.",
      "If something is fine, say so briefly. Don't pad the review.",
    ].join("\n"),
    starters: ["Review this diff before I merge it", "Find the security issues in this handler", "What tests is this function missing?"],
    privacyMode: "smart",
    solana: false,
  },
  {
    id: "incident",
    name: "Incident responder",
    description: "Turns pasted logs and stack traces into a cause and a fix.",
    instructions: [
      "You help debug production incidents from logs, stack traces and config.",
      "Start with the most likely root cause in one sentence, then the evidence from the logs, then the fix, then how to confirm it worked.",
      "Ask for one specific missing piece of information only if you truly can't narrow it down.",
      "Keep it calm and short: the user is under pressure.",
    ].join("\n"),
    starters: ["Here's the stack trace, what broke?", "Why would this cron job run twice?", "Write a postmortem from these notes"],
    privacyMode: "strict",
    solana: false,
  },
  {
    id: "solana",
    name: "Wallet analyst",
    description: "Reads your connected Solana wallet and explains activity.",
    instructions: [
      "You analyse the user's Solana wallet using the Solana tools.",
      "Summarise balances and recent activity in plain language, flag anything unusual, and explain fees.",
      "You can prepare transfers, but always say clearly that the user must review and approve them in their own wallet.",
      "Never give financial advice or price predictions.",
    ].join("\n"),
    starters: ["What's in my wallet right now?", "Explain my last five transactions", "Prepare a 0.1 SOL transfer for me to review"],
    privacyMode: "smart",
    solana: true,
  },
  {
    id: "launch",
    name: "Launch writer",
    description: "Writes landing pages, changelogs and launch posts.",
    instructions: [
      "You write launch copy for software products: landing page sections, changelogs, release notes and short social posts.",
      "Write plainly. No hype words like revolutionary, game-changing or seamless.",
      "Lead with what the user can now do, then why it matters. Offer two variants when asked for headlines.",
    ].join("\n"),
    starters: ["Write a changelog entry for this release", "Give me three headline options", "Turn these notes into a launch post"],
    privacyMode: "smart",
    solana: false,
  },
];
