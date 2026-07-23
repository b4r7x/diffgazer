import { expect, test } from "@playwright/test";

test.describe("Docs search", () => {
  test("opens from the global shortcut and navigates to a real result", async ({ page }) => {
    await page.goto("/");

    const searchShortcut = await page.evaluate(() =>
      /Mac|iPhone|iPad/.test(navigator.userAgent) ? "Meta+K" : "Control+K",
    );
    const search = page.getByRole("combobox", { name: /command search/i });
    await expect(async () => {
      await page.keyboard.press(searchShortcut);
      await expect(search).toBeVisible();
    }).toPass();

    await search.fill("button");

    const buttonResult = page
      .getByRole("option", { name: /button/i })
      .filter({ hasText: "Components" })
      .first();
    await expect(buttonResult).toBeVisible();
    await expect(buttonResult).toContainText("@diffgazer/ui");

    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/ui\/components\/button$/);
    await expect(page.getByRole("heading", { level: 1, name: "Button" })).toBeVisible();
  });
});
