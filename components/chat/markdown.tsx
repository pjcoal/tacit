"use client";

import { Check, Copy } from "lucide-react";
import { memo, useState, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";

// Sanitize first (untrusted model output), then highlight. Only language-* classes survive on <code>.
const schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code ?? []), ["className", /^language-[\w-]+$/]],
  },
};

function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (node && typeof node === "object" && "props" in node) return textOf((node as { props: { children?: ReactNode } }).props.children);
  return "";
}

export function CopyButton({ text, className, label = "Copy" }: { text: string; className?: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() =>
        navigator.clipboard.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1400);
        })
      }
      className={className ?? "inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[12px] text-dim transition-colors hover:text-ink"}
      aria-label={label}
    >
      {done ? <Check size={13} /> : <Copy size={13} />}
      <span>{done ? "Copied" : label}</span>
    </button>
  );
}

const components: Components = {
  pre({ children }) {
    const code = textOf(children).replace(/\n$/, "");
    const lang = /language-([\w-]+)/.exec(
      ((children as { props?: { className?: string } })?.props?.className as string) ?? "",
    )?.[1];
    return (
      <div className="not-prose my-4 overflow-hidden rounded-xl border border-panel-line bg-panel">
        <div className="flex items-center justify-between border-b border-panel-line px-3 py-1.5">
          <span className="font-mono text-[11px] text-panel-dim">{lang ?? "text"}</span>
          <CopyButton text={code} className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11.5px] text-panel-dim hover:text-panel-ink" />
        </div>
        <pre className="scrollbar-thin overflow-x-auto p-4 font-mono text-[12.5px] leading-[1.65] text-panel-ink">{children}</pre>
      </div>
    );
  },
  a({ href, children }) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer nofollow">
        {children}
      </a>
    );
  },
  img() {
    // Remote images in model output could be used to exfiltrate data via URLs; they are never loaded.
    return null;
  },
};

export const Markdown = memo(function Markdown({ text }: { text: string }) {
  return (
    <div className="prose-chat">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[[rehypeSanitize, schema], [rehypeHighlight, { detect: false, ignoreMissing: true }]]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
});
