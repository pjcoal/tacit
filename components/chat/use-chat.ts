"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useConfig } from "@/components/providers/config-provider";
import { createPlaceholderMap, restoreDeep, restorePartial, restoreResponse, sanitizePrompt, sendSanitizedPrompt } from "@/lib/privacy";
import type { PlaceholderMap, PrivacyMode } from "@/lib/privacy/types";
import { isWriteTool, runSolanaTool } from "@/lib/solana/tools-client";
import {
  deleteMessages,
  getConversation,
  getMessages,
  getSettings,
  putConversation,
  putMessage,
  uid,
  type Conversation,
  type StoredAttachment,
  type StoredMessage,
  type StoredToolCall,
} from "@/lib/storage/db";
import type { ReasoningLevel, StopReason, WireImage, WireMessage } from "@/types/chat";

export interface SendInput {
  text: string;
  images: WireImage[];
  textFiles: Array<{ name: string; content: string }>;
  attachments: StoredAttachment[];
  model: string;
  mode: PrivacyMode;
  reasoning: ReasoningLevel;
  tools: string[];
}

const MAX_TOOL_ROUNDS = 5;

interface TurnArgs {
  history: WireMessage[];
  userText?: string;
  images?: WireImage[];
  display?: { text: string; attachments: StoredAttachment[] };
  model: string;
  mode: PrivacyMode;
  reasoning: ReasoningLevel;
  tools: string[];
  depth: number;
  signal: AbortSignal;
}

export function useChat(conversationId: string | null, onCreated: (id: string) => void) {
  const cfg = useConfig();
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<StoredMessage[]>([]);
  const [loading, setLoading] = useState(Boolean(conversationId));
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const convRef = useRef<Conversation | null>(null);
  const msgsRef = useRef<StoredMessage[]>([]);
  const skipReload = useRef<string | null>(null);

  const setMsgs = useCallback((fn: (prev: StoredMessage[]) => StoredMessage[]) => {
    setMessages((prev) => {
      const next = fn(prev);
      msgsRef.current = next;
      return next;
    });
  }, []);

  // Sync local state with IndexedDB (an external store) whenever the URL's conversation id changes.
  useEffect(() => {
    if (conversationId && skipReload.current === conversationId) return;
    abortRef.current?.abort();
    if (!conversationId) {
      convRef.current = null;
      /* eslint-disable react-hooks/set-state-in-effect -- resetting to an empty conversation is the synchronization */
      setConversation(null);
      setMsgs(() => []);
      setLoading(false);
      /* eslint-enable react-hooks/set-state-in-effect */
      return;
    }
    setLoading(true);
    Promise.all([getConversation(conversationId), getMessages(conversationId)]).then(([c, m]) => {
      convRef.current = c ?? null;
      setConversation(c ?? null);
      setMsgs(() => m);
      setLoading(false);
    });
  }, [conversationId, setMsgs]);

  const knownMints = useCallback((): Record<string, string> => {
    const m: Record<string, string> = {
      EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: "USDC",
      "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU": "USDC (devnet)",
      So11111111111111111111111111111111111111112: "wSOL",
    };
    if (cfg.token.mint) m[cfg.token.mint] = cfg.token.symbol;
    return m;
  }, [cfg.token.mint, cfg.token.symbol]);

  const saveConversation = useCallback(async (patch: Partial<Conversation>) => {
    if (!convRef.current) return;
    const next = { ...convRef.current, ...patch, updatedAt: Date.now() };
    convRef.current = next;
    setConversation(next);
    await putConversation(next);
  }, []);

  // Lets runTurn call the latest version of itself for tool-result continuations.
  const runTurnRef = useRef<((args: TurnArgs) => Promise<void>) | null>(null);

  /** One model round-trip, followed by tool execution and continuation when the model asks for tools. */
  const runTurn = useCallback(
    async (args: TurnArgs): Promise<void> => {
      const conv = convRef.current!;
      let map: PlaceholderMap = conv.map;
      const { receipt, map: nextMap, sentMessage, events } = await sendSanitizedPrompt({
        history: args.history,
        userText: args.userText,
        images: args.images,
        mode: args.mode,
        map,
        model: args.model,
        reasoning: args.reasoning,
        tools: args.tools,
        signal: args.signal,
      });
      map = nextMap;
      await saveConversation({ map, model: args.model, privacyMode: args.mode });

      const history = [...args.history];
      if (sentMessage && receipt && args.display) {
        const userMsg: StoredMessage = {
          id: uid(),
          conversationId: conv.id,
          createdAt: Date.now(),
          role: "user",
          content: args.display.text,
          wire: sentMessage,
          receipt: { mode: receipt.mode, original: receipt.original, sanitized: receipt.sanitized, replacements: receipt.replacements, warnings: receipt.warnings },
          attachments: args.display.attachments,
        };
        await putMessage(userMsg);
        setMsgs((p) => [...p, userMsg]);
        history.push(sentMessage);
      }

      const asst: StoredMessage = {
        id: uid(),
        conversationId: conv.id,
        createdAt: Date.now() + 1,
        role: "assistant",
        content: "",
        wire: { role: "assistant", content: "" },
      };
      setMsgs((p) => [...p, asst]);

      let raw = "";
      let reasoning = "";
      let stopReason: StopReason = "end";
      let error: string | undefined;
      let providerState: unknown;
      const calls: Array<{ id: string; name: string; input: unknown }> = [];
      let frame = 0;
      let lastSaved = Date.now();
      const flush = () => {
        frame = 0;
        setMsgs((p) => p.map((m) => (m.id === asst.id ? { ...m, content: restorePartial(raw, map), reasoning } : m)));
        // Persist partial replies so a reload mid-stream doesn't lose them.
        if (Date.now() - lastSaved > 1000 && raw) {
          lastSaved = Date.now();
          void putMessage({ ...asst, content: restoreResponse(raw, map), reasoning: reasoning || undefined, stopReason: "aborted", wire: { role: "assistant", content: raw } });
        }
      };

      try {
        for await (const ev of events) {
          switch (ev.type) {
            case "meta":
              asst.model = ev.model;
              asst.modelLabel = ev.modelLabel;
              asst.billing = ev.billing;
              setMsgs((p) => p.map((m) => (m.id === asst.id ? { ...m, model: ev.model, modelLabel: ev.modelLabel, billing: ev.billing } : m)));
              break;
            case "text":
              raw += ev.delta;
              if (!frame) frame = requestAnimationFrame(flush);
              break;
            case "reasoning":
              reasoning += ev.delta;
              if (!frame) frame = requestAnimationFrame(flush);
              break;
            case "tool_call":
              calls.push({ id: ev.id, name: ev.name, input: ev.input });
              break;
            case "provider_state":
              providerState = ev.state;
              break;
            case "usage":
              asst.usage = { inputTokens: ev.inputTokens, outputTokens: ev.outputTokens, credits: ev.credits };
              break;
            case "error":
              error = ev.code === "insufficient_credits" || ev.code === "free_quota_exhausted" ? `${ev.message}` : ev.message;
              break;
            case "done":
              stopReason = ev.stopReason;
              break;
          }
        }
      } catch (e) {
        if (args.signal.aborted) stopReason = "aborted";
        else error = (e as Error).message;
      }
      if (frame) cancelAnimationFrame(frame);

      const toolCalls: StoredToolCall[] = calls.map((c) => ({ id: c.id, name: c.name, input: restoreDeep(c.input, map), status: "running" }));
      const final: StoredMessage = {
        ...asst,
        content: restoreResponse(raw, map),
        reasoning: reasoning || undefined,
        stopReason,
        error,
        toolCalls: toolCalls.length ? toolCalls : undefined,
        wire: {
          role: "assistant",
          content: raw,
          ...(calls.length ? { toolCalls: calls } : {}),
          ...(providerState ? { providerState } : {}),
        },
      };
      setMsgs((p) => p.map((m) => (m.id === asst.id ? final : m)));
      if (raw || calls.length || error) await putMessage(final);
      if (!(stopReason === "tool_use" && calls.length) || args.signal.aborted) return;

      // ---- Tool execution (in this browser) --------------------------------
      const settings = await getSettings();
      const toolWires: WireMessage[] = [];
      for (const tc of toolCalls) {
        let content: string;
        let isError = false;
        if (isWriteTool(tc.name) && settings.solanaWrites === "never") {
          tc.status = "blocked";
          content = JSON.stringify({ error: "The user has disabled transaction preparation in settings." });
          isError = true;
        } else if (!isWriteTool(tc.name) && settings.solanaReads === "never") {
          tc.status = "blocked";
          content = JSON.stringify({ error: "The user has disabled wallet reads in settings." });
          isError = true;
        } else {
          const outcome = await runSolanaTool(tc.name, tc.input, { connection, wallet: publicKey ?? null, knownMints: knownMints() });
          if (outcome.kind === "error") {
            tc.status = "error";
            tc.error = outcome.error;
            content = JSON.stringify({ error: outcome.error });
            isError = true;
          } else if (outcome.kind === "preview") {
            tc.status = "awaiting_approval";
            tc.preview = outcome.preview;
            tc.summary = outcome.summary;
            content = JSON.stringify({
              status: "shown_to_user_for_approval",
              note: "A preview is displayed. The user must approve and sign in their own wallet. It has NOT been sent.",
              preview: { amount: outcome.preview.amountUi, to: outcome.preview.to, kind: outcome.preview.kind, mint: outcome.preview.mint },
            });
          } else {
            tc.status = "done";
            tc.summary = outcome.summary;
            content = JSON.stringify(outcome.data);
          }
        }
        // Tool output goes back through the same filter (wallet addresses → placeholders).
        const r = sanitizePrompt(content, args.mode, map);
        map = r.map;
        toolWires.push({ role: "tool", toolCallId: tc.id, name: tc.name, content: r.sanitized, ...(isError ? { isError } : {}) });
      }
      final.toolCalls = toolCalls.map((t) => ({ ...t }));
      setMsgs((p) => p.map((m) => (m.id === final.id ? { ...final } : m)));
      await putMessage(final);
      for (const [i, w] of toolWires.entries()) {
        const tm: StoredMessage = { id: uid(), conversationId: conv.id, createdAt: Date.now() + 2 + i, role: "tool", content: "", wire: w };
        await putMessage(tm);
        setMsgs((p) => [...p, tm]);
      }
      await saveConversation({ map });

      if (args.depth + 1 >= MAX_TOOL_ROUNDS) return;
      await runTurnRef.current?.({ ...args, history: [...history, final.wire, ...toolWires], userText: undefined, images: undefined, display: undefined, depth: args.depth + 1 });
    },
    [connection, publicKey, knownMints, saveConversation, setMsgs],
  );
  useEffect(() => {
    runTurnRef.current = runTurn;
  }, [runTurn]);

  const send = useCallback(
    async (input: SendInput) => {
      if (streaming) return;
      const textForModel = [
        input.text,
        ...input.textFiles.map((f) => `--- attached file: ${f.name} ---\n${f.content}\n--- end of ${f.name} ---`),
      ]
        .filter(Boolean)
        .join("\n\n");
      if (!textForModel.trim() && !input.images.length) return;

      if (!convRef.current) {
        const c: Conversation = {
          id: uid(),
          title: (input.text.trim() || input.attachments[0]?.name || "New chat").replace(/\s+/g, " ").slice(0, 64),
          createdAt: Date.now(),
          updatedAt: Date.now(),
          model: input.model,
          privacyMode: input.mode,
          map: createPlaceholderMap(),
        };
        convRef.current = c;
        setConversation(c);
        await putConversation(c);
        skipReload.current = c.id;
        onCreated(c.id);
      }

      const controller = new AbortController();
      abortRef.current = controller;
      setStreaming(true);
      try {
        await runTurn({
          history: msgsRef.current.map((m) => m.wire),
          userText: textForModel || " ",
          images: input.images,
          display: { text: input.text, attachments: input.attachments },
          model: input.model,
          mode: input.mode,
          reasoning: input.reasoning,
          tools: input.tools,
          depth: 0,
          signal: controller.signal,
        });
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [streaming, runTurn, onCreated],
  );

  const regenerate = useCallback(
    async (opts: { model: string; mode: PrivacyMode; reasoning: ReasoningLevel; tools: string[] }) => {
      if (streaming) return;
      const msgs = msgsRef.current;
      const lastUser = msgs.map((m) => m.role).lastIndexOf("user");
      if (lastUser < 0) return;
      const drop = msgs.slice(lastUser + 1).map((m) => m.id);
      await deleteMessages(drop);
      setMsgs((p) => p.slice(0, lastUser + 1));
      const controller = new AbortController();
      abortRef.current = controller;
      setStreaming(true);
      try {
        await runTurn({ history: msgs.slice(0, lastUser + 1).map((m) => m.wire), ...opts, depth: 0, signal: controller.signal });
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [streaming, runTurn, setMsgs],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  const updateToolCall = useCallback(
    async (messageId: string, callId: string, patch: Partial<StoredToolCall>) => {
      const msg = msgsRef.current.find((m) => m.id === messageId);
      if (!msg?.toolCalls) return;
      const next = { ...msg, toolCalls: msg.toolCalls.map((t) => (t.id === callId ? { ...t, ...patch } : t)) };
      setMsgs((p) => p.map((m) => (m.id === messageId ? next : m)));
      await putMessage(next);
    },
    [setMsgs],
  );

  return { conversation, messages, loading, streaming, send, stop, regenerate, updateToolCall };
}
