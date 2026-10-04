import { expect, test } from "@playwright/test";

const MOCK = "http://127.0.0.1:4011";

test.describe("agents", () => {
  test("build an agent, chat with it, and the provider gets its instructions filtered", async ({ page, request }) => {
    await page.goto("/app/agents");
    await page.getByTestId("new-agent").click();
    const editor = page.getByTestId("agent-editor");
    await editor.getByLabel("Name").fill("Release captain");
    await editor.getByLabel("Description").fill("Keeps releases boring.");
    await editor.getByLabel("Instructions").fill("Always answer as a checklist. Escalate to priya@northwind.io.");
    await expect(editor).toContainText("1 detail here will be swapped");
    await editor.getByLabel("Starter 1").fill("Plan tonight's release");
    await page.getByTestId("save-and-chat").click();

    await expect(page).toHaveURL(/\/app\?agent=/);
    await expect(page.getByTestId("agent-intro")).toContainText("Release captain");
    await page.getByRole("button", { name: "Plan tonight's release" }).click();
    await expect(page.getByTestId("assistant-message").last()).toContainText("Echo: Plan tonight's release");
    await expect(page.getByTestId("agent-chip")).toContainText("Release captain");

    const last = await (await request.get(`${MOCK}/__last`)).json();
    const system = JSON.stringify(last.messages.filter((m: { role: string }) => m.role === "system"));
    expect(system).toContain("Release captain");
    expect(system).toContain("Always answer as a checklist.");
    expect(system).toContain("[EMAIL_1]");
    expect(JSON.stringify(last)).not.toContain("priya@northwind.io");

    // The conversation remembers its agent after a reload.
    await expect(page).toHaveURL(/\/app\?c=/);
    await expect(page.getByTestId("send")).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("agent-chip")).toContainText("Release captain");

    // Listed on the agents page, from a template too.
    await page.goto("/app/agents");
    await expect(page.getByTestId("agent-list")).toContainText("Release captain");
    await page.getByTestId("template-reviewer").click();
    await page.getByTestId("save-agent").click();
    await expect(page.getByTestId("agent-list")).toContainText("Code reviewer");
  });
});
