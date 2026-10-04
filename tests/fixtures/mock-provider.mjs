// Test fixture: a tiny OpenAI-compatible provider used by the e2e suite.
// The app talks to it through its real "custom" provider adapter
// (OPENAI_COMPATIBLE_BASE_URL), so the full request path is exercised.
// It also records the last request body so tests can assert on what a
// provider actually receives (e.g. that placeholders, not names, arrive).
import http from "node:http";

const port = Number(process.env.MOCK_PROVIDER_PORT ?? 4010);
let lastBody = null;

function sse(res, obj) {
  res.write(`data: ${JSON.stringify(obj)}\n\n`);
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/__last") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(lastBody));
    return;
  }
  if (req.method !== "POST" || !req.url?.endsWith("/chat/completions")) {
    res.writeHead(404).end();
    return;
  }
  let raw = "";
  for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw);
  lastBody = body;
  const msgs = body.messages ?? [];
  const last = msgs[msgs.length - 1];
  const lastUser = [...msgs].reverse().find((m) => m.role === "user");
  const userText = typeof lastUser?.content === "string" ? lastUser.content : (lastUser?.content ?? []).map((p) => p.text ?? "").join(" ");

  res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
  const base = { id: "chatcmpl-mock", object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model: body.model };

  // Tool round-trip: ask for a wallet overview, then summarise the tool result.
  if (body.tools?.length && last?.role === "user" && /wallet/i.test(userText)) {
    sse(res, { ...base, choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id: "call_1", function: { name: "solana_wallet_overview", arguments: "{}" } }] }, finish_reason: null }] });
    sse(res, { ...base, choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }] });
    sse(res, { ...base, choices: [], usage: { prompt_tokens: 12, completion_tokens: 3 } });
    res.end("data: [DONE]\n\n");
    return;
  }
  const reply =
    last?.role === "tool"
      ? `Tool result received: ${String(last.content).slice(0, 80)}`
      : `Echo: ${userText}\n\n| col | value |\n|---|---|\n| a | 1 |\n\n\`\`\`js\nconsole.log("hi")\n\`\`\``;
  const words = reply.split(/(?<=\s)/);
  for (const w of words) {
    sse(res, { ...base, choices: [{ index: 0, delta: { content: w }, finish_reason: null }] });
    await new Promise((r) => setTimeout(r, 8));
  }
  sse(res, { ...base, choices: [{ index: 0, delta: {}, finish_reason: "stop" }] });
  sse(res, { ...base, choices: [], usage: { prompt_tokens: 20, completion_tokens: words.length } });
  res.end("data: [DONE]\n\n");
});

server.listen(port, "127.0.0.1", () => console.log(`mock provider on :${port}`));
