import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("Menu", () => {
  test("supports arrow-key navigation and is accessible", async ({ page }) => {
    await page.goto("/ui/components/menu");
    await expect(page.getByRole("heading", { level: 1, name: /menu/i })).toBeVisible();

    const menu = page.getByRole("menu", { name: /file actions/i }).first();
    await expect(menu).toBeVisible();
    await menu.focus();

    const firstItem = menu.getByRole("menuitem", { name: /new file/i });
    await expect(firstItem).toBeVisible();
    await expect(menu).toHaveScreenshot("menu-open.png");

    await page.keyboard.press("ArrowDown");
    await expect(menu).toHaveAttribute(
      "aria-activedescendant",
      (await firstItem.getAttribute("id")) ?? "",
    );

    await page.keyboard.press("ArrowDown");
    const secondItem = menu.getByRole("menuitem", { name: /open file/i });
    await expect(menu).toHaveAttribute(
      "aria-activedescendant",
      (await secondItem.getAttribute("id")) ?? "",
    );

    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(results.violations).toEqual([]);
  });
});
