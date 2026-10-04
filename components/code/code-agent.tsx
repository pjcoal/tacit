"use client";

import { ArrowUp, Download, FileCode2, FolderTree, Play, Plus, Square, Terminal, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CopyButton, Markdown } from "@/components/chat/markdown";
import { Segmented } from "@/components/ui/segmented";
import { localBrowserSandbox, parseAgentFiles } from "@/lib/code/sandbox";
import { createPlaceholderMap, restorePartial, restoreResponse, sendSanitizedPrompt } from "@/lib/privacy";
import { deleteProject, getProject, listProjects, putProject, uid, type CodeProject } from "@/lib/storage/db";
import { useLive } from "@/lib/storage/hooks";
import { cn } from "@/lib/utils";
import type { WireMessage } from "@/types/chat";

type Pane = "chat" | "files" | "preview" | "log";

function filesContext(files: Record<string, string>) {
  const entries = Object.entries(files);
  if (!entries.length) return "";
  return (
    "\n\nCurrent project files:\n" +
    entries.map(([p, c]) => `\`\`\`${p.split(".").pop()} file=${p}\n${c}\n\`\`\``).join("\n\n")
  );
}

function hashString(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

function Preview({ html, ready }: { html: string; ready: boolean }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [runs, setRuns] = useState(0);
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || e.data?.type !== "tacit:sandbox-ready") return;
      frame.current?.contentWindow?.postMessage({ type: "tacit:preview", html }, "*");
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [html]);
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-line-2 px-3 py-2 text-[12px] text-dim">
        <span className="dot bg-mint" /> {localBrowserSandbox.label} · {localBrowserSandbox.description}
        {ready ? (
          <button onClick={() => setRuns((n) => n + 1)} className="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:text-ink">
            <Play size={12} /> Rerun
          </button>
        ) : null}
      </div>
      {ready ? (
        // A new key (content hash or manual rerun) remounts the sandbox with a fresh document.
        <iframe key={`${hashString(html)}:${runs}`} ref={frame} title="Project preview" src="/sandbox" sandbox="allow-scripts allow-modals" className="min-h-0 w-full flex-1 bg-white" />
      ) : (
        <div className="grid min-h-0 flex-1 place-items-center bg-sunken p-8 text-center">
          <div>
            <Play size={22} className="mx-auto text-faint" />
            <p className="mt-3 text-[14px] font-medium">Nothing to preview yet</p>
            <p className="mt-1 text-[13px] text-dim">Describe what to build and the live preview appears here.</p>
          </div>
        </div>
      )}
    </div>
  );
}

export function CodeAgent() {
  const params = useSearchParams();
  const router = useRouter();
  const pid = params.get("p");
  const { value: projects } = useLive("projects", listProjects, [] as CodeProject[]);
  const [loaded, setProject] = useState<CodeProject | null>(null);
  // Only show the project the URL points at (a stale one is never displayed after navigation).
  const project = pid && loaded?.id === pid ? loaded : null;
  const [input, setInput] = useState("");
  const model = "auto";
  const [streaming, setStreaming] = useState(false);
  const [live, setLive] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [pane, setPane] = useState<Pane>("chat");
  const [wide, setWide] = useState<"files" | "preview" | "log">("preview");
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => {
    if (!pid) return;
    let alive = true;
    getProject(pid).then((p) => {
      if (alive && p) setProject((cur) => (cur?.id === p.id ? cur : p));
    });
    return () => {
      alive = false;
    };
  }, [pid]);

  const files = useMemo(() => project?.files ?? {}, [project]);
  const fileNames = Object.keys(files).sort();
  const html = useMemo(() => {
    const r = localBrowserSandbox.prepare(files);
    return r.kind === "html" ? r.html : "";
  }, [files]);

  const addLog = (line: string) => setLog((l) => [...l, `${new Date().toLocaleTimeString()}  ${line}`]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;
    let p = project;
    if (!p) {
      p = { id: uid(), name: text.slice(0, 40), createdAt: Date.now(), updatedAt: Date.now(), files: {}, messages: [], map: createPlaceholderMap(), model };
      await putProject(p);
      setProject(p);
      router.replace(`/app/code?p=${p.id}`, { scroll: false });
    }
    setInput("");
    setError(null);
    setLog([]);
    addLog("sending request");
    const ctrl = new AbortController();
    abort.current = ctrl;
    setStreaming(true);
    setLive("");
    try {
      const history: WireMessage[] = p.messages.map((m) => m.wire);
      const { map, sentMessage, events } = await sendSanitizedPrompt({
        history,
        userText: text + filesContext(p.files),
        mode: "smart",
        map: p.map,
        model,
        signal: ctrl.signal,
        tools: [],
        chatMode: "code",
      });
      let raw = "";
      let modelLabel = "";
      const seen = new Set<string>();
      for await (const ev of events) {
        if (ev.type === "meta") {
          modelLabel = ev.modelLabel;
        } else if (ev.type === "text") {
          raw += ev.delta;
          const parsed = parseAgentFiles(raw);
          for (const f of Object.keys(parsed.files)) {
            if (!seen.has(f)) {
              seen.add(f);
              addLog(`wrote ${f} (${(parsed.files[f].length / 1024).toFixed(1)} KB)`);
            }
          }
          setLive(raw);
        } else if (ev.type === "error") {
          setError(ev.message);
          addLog(`error: ${ev.message}`);
        } else if (ev.type === "done") {
          addLog(`done (${ev.stopReason})`);
        }
      }
      const restored = restoreResponse(raw, map);
      const parsed = parseAgentFiles(restored);
      const nextFiles = { ...p.files, ...parsed.files };
      const next: CodeProject = {
        ...p,
        map,
        model,
        updatedAt: Date.now(),
        files: nextFiles,
        messages: [
          ...p.messages,
          { id: uid(), role: "user", content: text, wire: sentMessage! },
          ...(raw ? [{ id: uid(), role: "assistant" as const, content: restored, wire: { role: "assistant" as const, content: raw }, model: modelLabel }] : []),
        ],
      };
      await putProject(next);
      setProject(next);
      if (Object.keys(parsed.files).length) {
        addLog("preview updated");
        setSelected(Object.keys(parsed.files)[0]);
      }
    } catch (e) {
      if (!ctrl.signal.aborted) setError((e as Error).message);
      else addLog("stopped");
    } finally {
      setStreaming(false);
      setLive("");
      abort.current = null;
    }
  }, [input, streaming, model, router, project]);

  const liveParsed = live ? parseAgentFiles(restorePartial(live, project?.map ?? createPlaceholderMap())) : null;
  const shownFiles = liveParsed ? { ...files, ...liveParsed.files } : files;
  const current = selected && shownFiles[selected] !== undefined ? selected : (Object.keys(shownFiles)[0] ?? null);

  const chatPanel = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="scrollbar-thin min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
        {!project?.messages.length && !streaming ? (
          <div className="text-[13.5px] text-ink-2">
            <p className="font-medium text-ink">Describe a small web app.</p>
            <p className="mt-1">Examples: “a pomodoro timer with keyboard shortcuts”, “a tip calculator with a dark theme”, “a canvas particle toy that follows the mouse”.</p>
            <p className="mt-3 text-[12px] text-dim">Runs as static HTML/CSS/JS in a private sandbox with no network access.</p>
          </div>
        ) : null}
        {project?.messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="ml-auto max-w-[90%] rounded-2xl rounded-br-md bg-sunken px-3.5 py-2 text-[14px] whitespace-pre-wrap">
              {m.content}
            </div>
          ) : (
            <div key={m.id} className="text-[14px]">
              <Markdown text={parseAgentFiles(m.content).prose} />
            </div>
          ),
        )}
        {streaming ? (
          <div className="is-streaming text-[14px]">
            <Markdown text={liveParsed?.prose || "Thinking…"} />
            {liveParsed?.writing ? <p className="mt-2 font-mono text-[11.5px] text-dim">writing {liveParsed.writing}…</p> : null}
          </div>
        ) : null}
        {error ? <p className="rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger">{error}</p> : null}
      </div>
      <div className="border-t border-line-2 p-3">
        <div className="rounded-xl border border-line bg-surface focus-within:border-ink/30">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={2}
            placeholder={project?.messages.length ? "Ask for a change…" : "What should we build?"}
            aria-label="Describe your project"
            className="block w-full resize-none bg-transparent px-3 pt-2.5 text-[14px] outline-none placeholder:text-dim"
          />
          <div className="flex items-center gap-2 px-2 pb-2">
            {streaming ? (
              <button onClick={() => abort.current?.abort()} className="ml-auto grid h-8 w-8 place-items-center rounded-full bg-ink text-bg" aria-label="Stop">
                <Square size={12} fill="currentColor" />
              </button>
            ) : (
              <button onClick={send} disabled={!input.trim()} className="ml-auto grid h-8 w-8 place-items-center rounded-full bg-ink text-bg disabled:opacity-25" aria-label="Send">
                <ArrowUp size={15} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const filesPanel = (
    <div className="grid h-full min-h-0 grid-cols-[150px_1fr]">
      <ul className="scrollbar-thin overflow-y-auto border-r border-line-2 bg-sunken p-2 font-mono text-[12px]">
        <li className="flex items-center gap-1.5 px-1.5 py-1 text-dim">
          <FolderTree size={12} /> {project?.name ?? "project"}
        </li>
        {Object.keys(shownFiles)
          .sort()
          .map((f) => (
            <li key={f}>
              <button onClick={() => setSelected(f)} className={cn("w-full truncate rounded px-1.5 py-1 pl-4 text-left", current === f ? "bg-surface text-ink" : "text-ink-2 hover:text-ink")}>
                {f}
                {liveParsed?.writing === f ? " …" : ""}
              </button>
            </li>
          ))}
      </ul>
      <div className="flex min-h-0 flex-col bg-panel">
        {current ? (
          <>
            <div className="flex items-center justify-between border-b border-panel-line px-3 py-1.5 font-mono text-[11.5px] text-panel-dim">
              <span className="flex items-center gap-1.5">
                <FileCode2 size={12} /> {current}
              </span>
              <CopyButton text={shownFiles[current]} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11.5px] text-panel-dim hover:text-panel-ink" />
            </div>
            <pre className="scrollbar-thin min-h-0 flex-1 overflow-auto p-3 font-mono text-[12px] leading-[1.6] text-panel-ink">{shownFiles[current]}</pre>
          </>
        ) : (
          <p className="p-4 text-[13px] text-panel-dim">No files yet.</p>
        )}
      </div>
    </div>
  );

  const logPanel = (
    <pre className="scrollbar-thin h-full overflow-auto bg-panel p-3 font-mono text-[12px] leading-relaxed text-panel-ink">
      {log.length ? log.join("\n") : "$ waiting for a request"}
    </pre>
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line-2 px-4 py-2.5">
        <Terminal size={15} />
        <span className="text-[14px] font-semibold">Code</span>
        <select
          value={project?.id ?? ""}
          onChange={(e) => router.push(e.target.value ? `/app/code?p=${e.target.value}` : "/app/code")}
          aria-label="Project"
          className="ml-2 h-8 max-w-[200px] rounded-lg border border-line bg-surface px-2 text-[12.5px] outline-none"
        >
          <option value="">New project</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button onClick={() => router.push("/app/code")} className="grid h-8 w-8 place-items-center rounded-lg border border-line" aria-label="New project">
          <Plus size={14} />
        </button>
        {project ? (
          <>
            <button
              onClick={() => {
                const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
                const a = document.createElement("a");
                a.href = url;
                a.download = `${project.name.replace(/\W+/g, "-").toLowerCase() || "project"}.html`;
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-line px-2.5 text-[12.5px]"
              disabled={!fileNames.length}
            >
              <Download size={13} /> Bundled HTML
            </button>
            <button
              onClick={async () => {
                if (!confirm("Delete this project from this device?")) return;
                await deleteProject(project.id);
                router.push("/app/code");
              }}
              className="grid h-8 w-8 place-items-center rounded-lg text-dim hover:text-danger"
              aria-label="Delete project"
            >
              <Trash2 size={14} />
            </button>
          </>
        ) : null}
        <Segmented
          ariaLabel="Panel"
          size="sm"
          className="ml-auto lg:hidden"
          value={pane}
          onChange={setPane}
          options={[
            { value: "chat", label: "Chat" },
            { value: "files", label: "Files" },
            { value: "preview", label: "Preview" },
            { value: "log", label: "Log" },
          ]}
        />
      </div>

      {/* Mobile: one pane at a time */}
      <div className="min-h-0 flex-1 lg:hidden">{pane === "chat" ? chatPanel : pane === "files" ? filesPanel : pane === "preview" ? <Preview html={html} ready={Boolean(files["index.html"])} /> : logPanel}</div>

      {/* Desktop: chat + workspace */}
      <div className="hidden min-h-0 flex-1 lg:grid lg:grid-cols-[minmax(340px,0.85fr)_1.15fr]">
        <div className="min-h-0 border-r border-line-2">{chatPanel}</div>
        <div className="flex min-h-0 flex-col">
          <div className="flex items-center gap-1 border-b border-line-2 px-3 py-1.5">
            {(["preview", "files", "log"] as const).map((t) => (
              <button key={t} onClick={() => setWide(t)} className={cn("rounded-md px-2.5 py-1 font-mono text-[11.5px] uppercase tracking-wider", wide === t ? "bg-sunken text-ink" : "text-dim hover:text-ink")}>
                {t}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1">{wide === "preview" ? <Preview html={html} ready={Boolean(files["index.html"])} /> : wide === "files" ? filesPanel : logPanel}</div>
        </div>
      </div>
    </div>
  );
}
