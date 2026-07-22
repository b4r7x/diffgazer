import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("Dialog", () => {
  test("opens, closes via Escape, and has no a11y violations", async ({ page }) => {
    await page.goto("/ui/components/dialog");
    await expect(page.getByRole("heading", { level: 1, name: /dialog/i })).toBeVisible();

    const trigger = page.getByRole("button", { name: /open dialog/i }).first();
    await trigger.click();

    const dialog = page.getByRole("dialog").first();
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveScreenshot("dialog-open.png");

    const results = await new AxeBuilder({ page })
      .include('[aria-modal="true"]')
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(results.violations).toEqual([]);

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });
});
