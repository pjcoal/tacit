/**
 * Code-execution providers for the coding agent.
 *
 * "local-browser" bundles a static HTML/CSS/JS project into a single document
 * and runs it in an opaque-origin, network-less iframe (see app/sandbox).
 * Remote runtimes (containers that can run Node, Python, package installs)
 * plug in behind the same interface; none is configured by default and the
 * UI says so rather than pretending.
 */
export interface SandboxProvider {
  id: string;
  label: string;
  available: boolean;
  description: string;
  /** Produce something the preview pane can display. */
  prepare(files: Record<string, string>): { kind: "html"; html: string } | { kind: "unsupported"; reason: string };
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function normalize(path: string) {
  return path.replace(/^\.\//, "").replace(/^\//, "");
}

/** Inline local stylesheets and scripts referenced by index.html. */
export function bundleStaticProject(files: Record<string, string>): string {
  let html = files["index.html"];
  if (!html) {
    const list = Object.keys(files)
      .map((f) => `<li>${f.replace(/</g, "&lt;")}</li>`)
      .join("");
    return `<!doctype html><meta charset="utf-8"><body style="font:14px system-ui;padding:20px;color:#555"><p>No index.html yet.</p><ul>${list}</ul>`;
  }
  for (const [path, content] of Object.entries(files)) {
    const p = normalize(path);
    if (p.endsWith(".css")) {
      const re = new RegExp(`<link[^>]+href=["'](?:\\./|/)?${escapeRe(p)}["'][^>]*>`, "gi");
      html = html.replace(re, () => `<style>\n${content}\n</style>`);
    }
    if (p.endsWith(".js") || p.endsWith(".mjs")) {
      const re = new RegExp(`<script([^>]*)src=["'](?:\\./|/)?${escapeRe(p)}["']([^>]*)>\\s*</script>`, "gi");
      html = html.replace(re, (_m, a: string, b: string) => `<script${(a + b).replace(/\s+/g, " ")}>\n${content.replace(/<\/script/gi, "<\\/script")}\n</script>`);
    }
  }
  return html;
}

export const localBrowserSandbox: SandboxProvider = {
  id: "local-browser",
  label: "Browser sandbox",
  available: true,
  description: "Static HTML/CSS/JS, no network, isolated origin.",
  prepare(files) {
    return { kind: "html", html: bundleStaticProject(files) };
  },
};

export const remoteSandbox: SandboxProvider = {
  id: "remote",
  label: "Remote runtime",
  available: false,
  description: "Container runtime for Node/Python projects — not configured on this deployment.",
  prepare() {
    return { kind: "unsupported", reason: "No remote runtime is configured." };
  },
};

/** Parse "```lang file=path" blocks from agent output. The last block may be incomplete while streaming. */
export function parseAgentFiles(text: string): { files: Record<string, string>; writing: string | null; prose: string } {
  const files: Record<string, string> = {};
  const complete = /```[\w+-]*[ \t]+file=([^\s`]+)[^\n]*\n([\s\S]*?)```/g;
  let prose = text.replace(complete, (_m, path: string, body: string) => {
    files[normalize(path)] = body.replace(/\n$/, "");
    return `\n\`${normalize(path)}\` ✓\n`;
  });
  let writing: string | null = null;
  const partial = /```[\w+-]*[ \t]+file=([^\s`]+)[^\n]*\n([\s\S]*)$/.exec(prose);
  if (partial) {
    writing = normalize(partial[1]);
    prose = prose.slice(0, partial.index) + `\n\`${writing}\` …\n`;
  }
  return { files, writing, prose: prose.trim() };
}
