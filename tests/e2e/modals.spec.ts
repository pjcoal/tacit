import { expect, test } from "@playwright/test";

test.describe("wallet, credits and token modals", () => {
  test("wallet modal never asks for secrets and lists install options", async ({ page }) => {
    await page.goto("/app");
    await page.getByTestId("connect-wallet").first().click();
    const modal = page.getByTestId("wallet-modal");
    await expect(modal).toBeVisible();
    await expect(modal).toContainText("never ask for your recovery phrase or private key");
    await expect(modal.getByRole("link", { name: /Get Phantom/ })).toBeVisible();
    await expect(page.locator("input[type=password]")).toHaveCount(0);
  });

  test("account creation encrypts a vault file, then the credits purchase dialog opens", async ({ page }) => {
    await page.goto("/app/credits");
    await page.getByTestId("create-account").click();
    await page.getByLabel("Passphrase", { exact: true }).fill("correct horse battery");
    await page.getByLabel("Confirm passphrase").fill("correct horse battery");
    const download = page.waitForEvent("download");
    await page.getByTestId("create-vault").click();
    expect((await download).suggestedFilename()).toBe("veil-vault.json");
    await page.getByText("Show the unencrypted key").click();
    await expect(page.getByTestId("recovery-key")).toContainText(/^veil_acct_/);
    await page.getByRole("checkbox").check();
    await page.getByTestId("saved-key").click();
    await expect(page.getByTestId("balance-card")).toContainText("0");

    await page.getByTestId("buy-credits").click();
    const dialog = page.getByTestId("purchase-dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Connect wallet" })).toBeVisible();
  });

  test("the vault file restores the account only with the right passphrase", async ({ page }) => {
    await page.goto("/app/credits");
    await page.getByTestId("create-account").click();
    await page.getByLabel("Passphrase", { exact: true }).fill("correct horse battery");
    await page.getByLabel("Confirm passphrase").fill("correct horse battery");
    const download = page.waitForEvent("download");
    await page.getByTestId("create-vault").click();
    const vaultPath = await (await download).path();
    await page.getByRole("checkbox").check();
    await page.getByTestId("saved-key").click();
    await expect(page.getByTestId("balance-card")).toBeVisible();

    // Sign this browser out, then restore from the file.
    await page.context().clearCookies();
    await page.reload();
    await page.locator("input[type=file]").setInputFiles(vaultPath);
    await page.getByLabel("Vault passphrase").fill("wrong passphrase");
    await page.getByRole("button", { name: "Unlock" }).click();
    await expect(page.getByTestId("account-gate")).toContainText("Wrong passphrase");
    await page.getByLabel("Vault passphrase").fill("correct horse battery");
    await page.getByRole("button", { name: "Unlock" }).click();
    await expect(page.getByTestId("balance-card")).toBeVisible();
  });

  test("API keys are shown once and can be revoked", async ({ page }) => {
    // Fresh browser context → no account yet; the API page offers to create one.
    await page.goto("/app/developers");
    await page.getByTestId("create-account").click();
    await page.getByLabel("Passphrase", { exact: true }).fill("correct horse battery");
    await page.getByLabel("Confirm passphrase").fill("correct horse battery");
    await page.getByTestId("create-vault").click();
    await page.getByRole("checkbox").check();
    await page.getByTestId("saved-key").click();
    await page.getByTestId("create-key").click();
    await expect(page.getByTestId("new-key")).toContainText(/^veil_sk_/);
    await page.getByRole("button", { name: "Done" }).click();
    await expect(page.getByTestId("key-list")).toContainText("Active");
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Revoke" }).first().click();
    await expect(page.getByTestId("key-list")).toContainText("Revoked");
  });

  test("buy token modal opens from the landing page and requires a wallet", async ({ page }) => {
    await page.goto("/#token");
    await page.getByRole("button", { name: /Buy \$/ }).click();
    const modal = page.getByTestId("buy-token-modal");
    await expect(modal).toBeVisible();
    await expect(modal.getByRole("button", { name: "Connect wallet" })).toBeVisible();
    await expect(modal).toContainText("Max slippage");
  });
});
