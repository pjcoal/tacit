import { afterEach, describe, expect, it, vi } from "vitest";
import { createPlaceholderMap, restoreResponse, sendSanitizedPrompt } from "@/lib/privacy";

afterEach(() => vi.unstubAllGlobals());

function captureFetch() {
  const bodies: Array<Record<string, unknown>> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)));
      return new Response("", { status: 200 });
    }),
  );
  return bodies;
}

describe("custom agents", () => {
  it("filters agent instructions in the browser, like messages", async () => {
    const bodies = captureFetch();
    const r = await sendSanitizedPrompt({
      history: [],
      userText: "Status update please",
      mode: "smart",
      map: createPlaceholderMap(),
      model: "auto",
      agent: { name: "Ops helper", instructions: "Escalate to maya@northwind.io and deploy key sk-proj-9fQ2LmX8vT4rB7nK1pZ6wY3cAbCd." },
    });
    const sent = bodies[0].agent as { name: string; instructions: string };
    expect(sent.instructions).not.toContain("maya@northwind.io");
    expect(sent.instructions).not.toContain("sk-proj-");
    expect(sent.instructions).toContain("[EMAIL_1]");
    expect(sent.instructions).toContain("[SECRET_1]");
    // Placeholders share the conversation map, so replies mentioning them are restored locally.
    expect(restoreResponse("Escalating to [EMAIL_1].", r.map)).toBe("Escalating to maya@northwind.io.");
  });

  it("omits the agent field for ordinary chats", async () => {
    const bodies = captureFetch();
    await sendSanitizedPrompt({ history: [], userText: "hi", mode: "smart", map: createPlaceholderMap(), model: "auto" });
    expect(bodies[0]).not.toHaveProperty("agent");
  });
});
