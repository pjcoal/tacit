import { expect, test } from "@playwright/test";

test.describe("landing page", () => {
  test("renders hero, sections and CSP", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto("/");
    expect(res?.headers()["content-security-policy"]).toMatch(/script-src 'self' 'nonce-/);
    expect(res?.headers()["x-frame-options"]).toBe("DENY");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Ask anything.");
    await expect(page.getByRole("link", { name: "Start private chat" }).first()).toBeVisible();
    for (const id of ["privacy", "models", "products", "solutions", "app", "code", "connect", "pay", "token", "api", "plans"]) {
      await expect(page.locator(`#${id}`)).toHaveCount(1);
    }
    expect(errors).toEqual([]);
  });

  test("privacy demo runs the real sanitizer", async ({ page }) => {
    await page.goto("/#privacy");
    const box = page.getByRole("textbox", { name: "Try your own prompt" });
    await box.fill("Email maya@example.com and tell Priya about Lisbon.");
    const section = page.locator("#privacy");
    await expect(section.getByText("[EMAIL_1]").first()).toBeVisible();
    await expect(section.getByText("[PERSON_1]").first()).toBeVisible();
    await expect(section.getByText("[CITY_1]").first()).toBeVisible();
  });

  test("product tabs switch previews", async ({ page }) => {
    await page.goto("/#products");
    await page.getByRole("tab", { name: /code/i }).click();
    await expect(page.getByRole("heading", { name: "Describe it. Watch it run." }).first()).toBeVisible();
    await page.getByRole("tab", { name: /connect/i }).click();
    await expect(page.getByText("A Solana connector that can't spend.")).toBeVisible();
  });

  test("model availability reflects configuration", async ({ page }) => {
    await page.goto("/#models");
    await expect(page.locator("#models").getByText("Local Echo (fixture)")).toBeVisible();
    await expect(page.locator("#models").getByText("Provider not configured")).toBeVisible();
  });

  test("token section links are derived from the mint and buyback is labelled planned", async ({ page }) => {
    await page.goto("/#token");
    const token = page.locator("#token");
    await expect(token.getByText("Planned").first()).toBeVisible();
    await expect(token.getByRole("link", { name: /View on pump.fun/ })).toHaveAttribute("href", /pump\.fun\/coin\/So11111111111111111111111111111111111111112/);
    await expect(token.getByRole("link", { name: /View on Solana Explorer/ })).toHaveAttribute("href", /cluster=devnet/);
  });
});
