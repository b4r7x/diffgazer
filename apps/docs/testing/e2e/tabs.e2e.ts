import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("Tabs", () => {
  test("switches via ArrowRight and is accessible", async ({ page }) => {
    await page.goto("/ui/components/tabs");
    await expect(page.getByRole("heading", { level: 1, name: /tabs/i })).toBeVisible();

    const tablist = page
      .getByRole("tablist")
      .filter({ has: page.getByRole("tab", { name: /tests/i }) })
      .first();
    await expect(tablist).toBeVisible();

    const previewTab = tablist.getByRole("tab", { name: /preview/i });
    await previewTab.focus();
    await expect(previewTab).toHaveAttribute("aria-selected", "true");
    await expect(previewTab).toHaveScreenshot("tabs-first-selected.png");

    await page.keyboard.press("ArrowRight");
    const codeTab = tablist.getByRole("tab", { name: /code/i });
    await expect(codeTab).toHaveAttribute("aria-selected", "true");

    const codePanelId = await codeTab.getAttribute("aria-controls");
    if (!codePanelId) throw new Error("Code tab did not expose aria-controls");
    const codePanel = page.locator(`[id="${codePanelId}"]`);
    await expect(codePanel).toContainText("Source code displayed here with syntax highlighting.");

    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(results.violations).toEqual([]);
  });
});
