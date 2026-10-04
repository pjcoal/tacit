import { expect, test } from "@playwright/test";

const WIDTHS = [375, 390, 768, 1024, 1440, 1920];
const PAGES = ["/", "/privacy", "/app", "/app/credits", "/app/developers", "/app/image", "/app/video", "/app/code", "/app/settings"];

test.describe("responsive layout", () => {
  for (const width of WIDTHS) {
    test(`no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      for (const path of PAGES) {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, `${path} overflows at ${width}px`).toBeLessThanOrEqual(0);
      }
    });
  }

  test("mobile navigation opens and closes", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.getByRole("button", { name: "Open menu" }).click();
    const menu = page.locator("#mobile-menu");
    await expect(menu).toBeVisible();
    await menu.getByRole("link", { name: "Plans" }).click();
    await expect(menu).toBeHidden();
    await expect(page).toHaveURL(/#plans/);
  });

  test("app drawer works on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/app");
    await page.getByTestId("app-menu").click();
    await expect(page.getByTestId("new-chat").last()).toBeVisible();
  });
});
