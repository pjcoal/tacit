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
