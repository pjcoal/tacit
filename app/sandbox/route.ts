/**
 * Preview host for the coding agent. It is always framed with
 * sandbox="allow-scripts" (no allow-same-origin), so generated code runs in an
 * opaque origin: no access to our cookies, storage or APIs, and its CSP blocks
 * all network access. The parent posts the bundled HTML via postMessage.
 */
const HTML = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;font:14px system-ui;color:#555}</style></head>
<body><p style="padding:16px">Waiting for preview…</p>
<script>
window.addEventListener("message", function (e) {
  if (e.source !== window.parent || !e.data || e.data.type !== "tacit:preview" || typeof e.data.html !== "string") return;
  document.open(); document.write(e.data.html); document.close();
});
window.parent.postMessage({ type: "tacit:sandbox-ready" }, "*");
</script></body></html>`;

export function GET() {
  return new Response(HTML, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "content-security-policy":
        "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'self'",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
    },
  });
}
