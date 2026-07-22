import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("CommandPalette", () => {
  test("filters items by typing and remains accessible", async ({ page }) => {
    await page.goto("/ui/components/command-palette");
    await expect(page.getByRole("heading", { level: 1, name: /command palette/i })).toBeVisible();

    const trigger = page.getByRole("button", { name: /open command palette/i }).first();
    await trigger.click();

    const search = page.getByRole("combobox", { name: /command search/i });
    await expect(search).toBeVisible();
    await search.fill("a");

    await expect(page.getByRole("option", { name: "Run Diagnostics" })).toBeVisible();
    await expect(page.getByRole("option")).toHaveCount(1);
    await expect(page.getByRole("option", { name: "Go to History" })).toHaveCount(0);
    await expect(page.getByRole("option", { name: "Switch Theme" })).toHaveCount(0);

    await expect(search).toHaveScreenshot("command-palette-filtered.png");

    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(results.violations).toEqual([]);
  });
});
