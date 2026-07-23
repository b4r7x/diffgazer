import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("Accordion", () => {
  test("expands and collapses panels with no a11y violations", async ({ page }) => {
    await page.goto("/ui/components/accordion");
    await expect(page.getByRole("heading", { level: 1, name: /accordion/i })).toBeVisible();

    const installTrigger = page
      .getByRole("button", { name: /how do i install components/i })
      .first();
    const installPanel = page
      .getByRole("paragraph")
      .filter({ hasText: /run\s+dgadd add button\s+to add a component/i });
    await expect(installTrigger).toBeVisible();
    await expect(installTrigger).toHaveAttribute("aria-expanded", "false");
    await expect(installPanel).toBeHidden();

    await installTrigger.click();
    await expect(installTrigger).toHaveAttribute("aria-expanded", "true");
    await expect(installPanel).toBeVisible();
    await expect(installTrigger).toHaveScreenshot("accordion-expanded-trigger.png");

    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(results.violations).toEqual([]);

    await installTrigger.click();
    await expect(installTrigger).toHaveAttribute("aria-expanded", "false");
    await expect(installPanel).toBeHidden();
  });
});
