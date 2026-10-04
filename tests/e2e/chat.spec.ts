import { expect, test } from "@playwright/test";

const MOCK = "http://127.0.0.1:4011";

test.describe("chat", () => {
  test("streams a reply, sends only placeholders, restores locally, and shows a receipt", async ({ page, request }) => {
    await page.goto("/app");
    await page.getByTestId("composer-input").fill("Find restaurants near my home in Dublin and send the result to Alice.");
    await page.getByTestId("send").click();

    const reply = page.getByTestId("assistant-message").last();
    await expect(reply).toContainText("Echo: Find restaurants near my home in Dublin and send the result to Alice.");
    await expect(reply.locator("table")).toBeVisible();
    await expect(reply.locator("pre code")).toContainText('console.log("hi")');

    // What the provider actually received:
    const last = await (await request.get(`${MOCK}/__last`)).json();
    const sent = last.messages.at(-1).content as string;
    expect(sent).toBe("Find restaurants near my home in [CITY_1] and send the result to [PERSON_1].");
    expect(JSON.stringify(last)).not.toContain("Dublin");
    expect(JSON.stringify(last)).not.toContain("Alice");

    await page.getByTestId("privacy-receipt-toggle").first().click();
    const receipt = page.getByTestId("privacy-receipt");
    await expect(receipt).toContainText("You sent");
    await expect(receipt).toContainText("[CITY_1]");

    // Conversation is persisted locally and listed in the sidebar.
    await expect(page).toHaveURL(/\/app\?c=/);
    await expect(page.getByTestId("send")).toBeVisible(); // stream finished
    await page.reload();
    await expect(page.getByTestId("assistant-message").last()).toContainText("Echo:");
  });

  test("regenerate replaces the last reply", async ({ page }) => {
    await page.goto("/app");
    await page.getByTestId("composer-input").fill("hello there");
    await page.getByTestId("send").click();
    await expect(page.getByTestId("assistant-message").last()).toContainText("Echo: hello there");
    await page.getByTestId("assistant-message").last().hover();
    await page.getByTestId("regenerate").click();
    await expect(page.getByTestId("assistant-message")).toHaveCount(1);
    await expect(page.getByTestId("assistant-message").last()).toContainText("Echo: hello there");
  });

  test("solana tool call without a wallet returns a helpful tool error, not a crash", async ({ page }) => {
    await page.goto("/app");
    await page.getByTestId("solana-tools").click();
    await page.getByTestId("composer-input").fill("What's in my wallet?");
    await page.getByTestId("send").click();
    await expect(page.getByText("solana_wallet_overview")).toBeVisible();
    await expect(page.getByText(/No wallet is connected/).first()).toBeVisible();
    await expect(page.getByTestId("assistant-message").last()).toContainText("Tool result received");
  });

  test("OpenAI-compatible API requires a key", async ({ request }) => {
    const r = await request.post("/api/v1/chat/completions", { data: { model: "local-echo", messages: [{ role: "user", content: "hi" }] } });
    expect(r.status()).toBe(401);
    expect((await r.json()).error.code).toBe("missing_api_key");
  });
});
