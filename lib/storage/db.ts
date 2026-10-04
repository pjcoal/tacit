"use client";

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { PlaceholderMap, PrivacyMode, Replacement } from "@/lib/privacy/types";
import type { ReasoningLevel, StopReason, WireMessage } from "@/types/chat";

/**
 * Everything conversational lives here, in the user's browser. The server has
 * no copy. Clearing site data (or Settings → Delete local data) erases it.
 */

export interface Receipt {
  mode: PrivacyMode;
  original: string;
  sanitized: string;
  replacements: Replacement[];
  warnings: string[];
}

export type ToolStatus = "running" | "done" | "error" | "awaiting_approval" | "submitted" | "confirmed" | "rejected" | "blocked";

export interface StoredToolCall {
  id: string;
  name: string;
  /** Input with placeholders restored (local only). */
  input: unknown;
  status: ToolStatus;
  summary?: string;
  preview?: TransferPreview;
  signature?: string;
  error?: string;
}

export interface TransferPreview {
  kind: "sol" | "token";
  to: string;
  amountUi: number;
  amountBase: string;
  mint?: string;
  decimals?: number;
  symbol?: string;
  tokenProgram?: string;
  feeLamports: number;
  createsRecipientAccount?: boolean;
}

export interface StoredAttachment {
  kind: "image" | "text";
  name: string;
  mime: string;
  size: number;
  dataUrl?: string;
}

export interface StoredMessage {
  id: string;
  conversationId: string;
  createdAt: number;
  role: "user" | "assistant" | "tool";
  /** What the user sees: their original text, or the restored model reply. */
  content: string;
  /** Exactly what was (or will be) sent to the server. */
  wire: WireMessage;
  receipt?: Receipt;
  attachments?: StoredAttachment[];
  model?: string;
  modelLabel?: string;
  reasoning?: string;
  toolCalls?: StoredToolCall[];
  usage?: { inputTokens: number; outputTokens: number; credits: number };
  billing?: "free" | "credits";
  stopReason?: StopReason;
  error?: string;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  model: string;
  privacyMode: PrivacyMode;
  map: PlaceholderMap;
  /** Set when the conversation was started with a custom agent. */
  agentId?: string;
}

/** A user-defined agent. Lives only in this browser, like conversations. */
export interface Agent {
  id: string;
  name: string;
  description: string;
  instructions: string;
  /** Up to four conversation starters shown on the agent's empty chat. */
  starters: string[];
  privacyMode: PrivacyMode;
  /** Start chats with the Solana connector on. */
  solana: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface StoredImage {
  id: string;
  createdAt: number;
  prompt: string;
  sentPrompt: string;
  model: string;
  aspectRatio: string;
  quality?: string;
  blob: Blob;
}

export interface StoredVideo {
  id: string;
  createdAt: number;
  prompt: string;
  model: string;
  durationSec: number;
  resolution: string;
  job: string;
  status: "queued" | "running" | "succeeded" | "failed";
  progress: number | null;
  remoteUrl?: string;
  blob?: Blob;
  error?: string;
}

export interface CodeProject {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  files: Record<string, string>;
  messages: Array<{ id: string; role: "user" | "assistant"; content: string; wire: WireMessage; model?: string; log?: string[] }>;
  map: PlaceholderMap;
  model: string;
}

export interface Settings {
  theme: "system" | "light" | "dark";
  privacyMode: PrivacyMode;
  model: string;
  reasoning: ReasoningLevel;
  solanaReads: "auto" | "never";
  solanaWrites: "ask" | "never";
}

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  privacyMode: "smart",
  model: "auto",
  reasoning: "medium",
  solanaReads: "auto",
  solanaWrites: "ask",
};

interface VeilDB extends DBSchema {
  conversations: { key: string; value: Conversation; indexes: { "by-updated": number } };
  messages: { key: string; value: StoredMessage; indexes: { "by-conversation": [string, number] } };
  images: { key: string; value: StoredImage; indexes: { "by-created": number } };
  videos: { key: string; value: StoredVideo; indexes: { "by-created": number } };
  projects: { key: string; value: CodeProject; indexes: { "by-updated": number } };
  agents: { key: string; value: Agent; indexes: { "by-updated": number } };
  kv: { key: string; value: unknown };
}

let dbPromise: Promise<IDBPDatabase<VeilDB>> | null = null;

// The IndexedDB name predates the rename to Veil; keeping it preserves existing local history.
export function db() {
  dbPromise ??= openDB<VeilDB>("tacit", 2, {
    upgrade(d, oldVersion) {
      if (oldVersion < 1) {
        d.createObjectStore("conversations", { keyPath: "id" }).createIndex("by-updated", "updatedAt");
        d.createObjectStore("messages", { keyPath: "id" }).createIndex("by-conversation", ["conversationId", "createdAt"]);
        d.createObjectStore("images", { keyPath: "id" }).createIndex("by-created", "createdAt");
        d.createObjectStore("videos", { keyPath: "id" }).createIndex("by-created", "createdAt");
        d.createObjectStore("projects", { keyPath: "id" }).createIndex("by-updated", "updatedAt");
        d.createObjectStore("kv");
      }
      if (oldVersion < 2) {
        d.createObjectStore("agents", { keyPath: "id" }).createIndex("by-updated", "updatedAt");
      }
    },
  });
  return dbPromise;
}

/* ---- change notifications (so the sidebar updates live) ---------------- */
type Topic = "conversations" | "images" | "videos" | "projects" | "agents" | "settings";
const listeners = new Map<Topic, Set<() => void>>();
export function subscribe(topic: Topic, fn: () => void) {
  if (!listeners.has(topic)) listeners.set(topic, new Set());
  listeners.get(topic)!.add(fn);
  return () => {
    listeners.get(topic)!.delete(fn);
  };
}
export function emit(topic: Topic) {
  listeners.get(topic)?.forEach((fn) => fn());
}

export const uid = () => crypto.randomUUID();

/* ---- conversations ------------------------------------------------------ */
export async function listConversations(): Promise<Conversation[]> {
  const all = await (await db()).getAllFromIndex("conversations", "by-updated");
  return all.reverse();
}
export async function getConversation(id: string) {
  return (await db()).get("conversations", id);
}
export async function putConversation(c: Conversation) {
  await (await db()).put("conversations", c);
  emit("conversations");
}
export async function deleteConversation(id: string) {
  const d = await db();
  const tx = d.transaction(["conversations", "messages"], "readwrite");
  const idx = tx.objectStore("messages").index("by-conversation");
  for await (const cursor of idx.iterate(IDBKeyRange.bound([id, 0], [id, Infinity]))) await cursor.delete();
  await tx.objectStore("conversations").delete(id);
  await tx.done;
  emit("conversations");
}
export async function getMessages(conversationId: string): Promise<StoredMessage[]> {
  return (await db()).getAllFromIndex("messages", "by-conversation", IDBKeyRange.bound([conversationId, 0], [conversationId, Infinity]));
}
export async function putMessage(m: StoredMessage) {
  await (await db()).put("messages", m);
}
export async function deleteMessages(ids: string[]) {
  const d = await db();
  const tx = d.transaction("messages", "readwrite");
  await Promise.all(ids.map((id) => tx.store.delete(id)));
  await tx.done;
}

/* ---- media / projects --------------------------------------------------- */
export async function listImages() {
  return (await (await db()).getAllFromIndex("images", "by-created")).reverse();
}
export async function putImage(i: StoredImage) {
  await (await db()).put("images", i);
  emit("images");
}
export async function deleteImage(id: string) {
  await (await db()).delete("images", id);
  emit("images");
}
export async function listVideos() {
  return (await (await db()).getAllFromIndex("videos", "by-created")).reverse();
}
export async function putVideo(v: StoredVideo) {
  await (await db()).put("videos", v);
  emit("videos");
}
export async function deleteVideo(id: string) {
  await (await db()).delete("videos", id);
  emit("videos");
}
export async function listProjects() {
  return (await (await db()).getAllFromIndex("projects", "by-updated")).reverse();
}
export async function getProject(id: string) {
  return (await db()).get("projects", id);
}
export async function putProject(p: CodeProject) {
  await (await db()).put("projects", p);
  emit("projects");
}
export async function deleteProject(id: string) {
  await (await db()).delete("projects", id);
  emit("projects");
}

/* ---- settings ----------------------------------------------------------- */
export async function getSettings(): Promise<Settings> {
  const s = (await (await db()).get("kv", "settings")) as Partial<Settings> | undefined;
  return { ...DEFAULT_SETTINGS, ...s };
}
export async function saveSettings(s: Settings) {
  await (await db()).put("kv", s, "settings");
  try {
    if (s.theme === "system") localStorage.removeItem("tacit:theme");
    else localStorage.setItem("tacit:theme", s.theme);
  } catch {}
  if (s.theme === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = s.theme;
  emit("settings");
}

/* ---- agents ------------------------------------------------------------ */
export async function listAgents(): Promise<Agent[]> {
  return (await (await db()).getAllFromIndex("agents", "by-updated")).reverse();
}
export async function getAgent(id: string) {
  return (await db()).get("agents", id);
}
export async function putAgent(a: Agent) {
  await (await db()).put("agents", a);
  emit("agents");
}
export async function deleteAgent(id: string) {
  await (await db()).delete("agents", id);
  emit("agents");
}

/* ---- export / wipe ------------------------------------------------------ */
export async function exportAll() {
  const d = await db();
  const [conversations, messages, projects, agents, settings] = await Promise.all([
    d.getAll("conversations"),
    d.getAll("messages"),
    d.getAll("projects"),
    d.getAll("agents"),
    d.get("kv", "settings"),
  ]);
  return { exportedAt: new Date().toISOString(), conversations, messages, projects, agents, settings };
}

export async function wipeAll() {
  const d = await db();
  await Promise.all((["conversations", "messages", "images", "videos", "projects", "agents", "kv"] as const).map((s) => d.clear(s)));
  (["conversations", "images", "videos", "projects", "agents", "settings"] as const).forEach(emit);
}
