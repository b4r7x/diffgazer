import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("Toast", () => {
  test("appears on trigger, exposes status role, no a11y violations", async ({ page }) => {
    await page.goto("/ui/components/toast");
    await expect(page.getByRole("heading", { level: 1, name: /toast/i })).toBeVisible();

    const trigger = page.getByRole("button", { name: /^success$/i }).first();
    await trigger.click();

    const region = page.getByRole("region", { name: /notifications/i });
    const toast = region.getByRole("status").first();
    await toast.waitFor({ state: "visible" });
    await expect(toast).toContainText(/saved/i);
    await expect(toast).toHaveScreenshot("toast-visible.png");

    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(results.violations).toEqual([]);
  });
});
