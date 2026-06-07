import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("Tooltip", () => {
  test("appears on hover and is accessible", async ({ page }) => {
    await page.goto("/ui/components/tooltip");
    await expect(page.getByRole("heading", { level: 1, name: /tooltip/i })).toBeVisible();

    const previewPane = page.getByRole("tabpanel", { name: /preview/i }).first();
    const trigger = previewPane.getByText("hover me", { exact: true }).first();
    await expect(trigger).toBeVisible();
    await trigger.hover();

    const tooltip = page.getByRole("tooltip").first();
    await tooltip.waitFor({ state: "visible", timeout: 10_000 });
    await expect(tooltip).toContainText(/shorthand tooltip/i);
    await expect(tooltip).toHaveScreenshot("tooltip-visible.png");

    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(results.violations).toEqual([]);

    await page.mouse.move(0, 0);
    await expect(tooltip).toBeHidden();
  });
});
