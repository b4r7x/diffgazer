import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("Menu", () => {
  test("supports arrow-key navigation and is accessible", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "Visual baseline is desktop-only.");

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

  test("uses a desktop flyout and a mobile stack with focus return", async ({ page }, testInfo) => {
    await page.goto("/ui/components/menu");

    const preview = page
      .getByRole("heading", { level: 4, name: "Submenu", exact: true })
      .locator("..");
    const menu = preview.getByRole("menu", { name: "Application menu" });
    const editItem = menu.getByRole("menuitem", { name: "Edit", exact: true });
    const editId = await editItem.getAttribute("id");
    if (!editId) throw new Error("Edit menu item is missing an id");

    await menu.focus();
    await page.keyboard.press("Home");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await expect(menu).toHaveAttribute("aria-activedescendant", editId);

    const originalBounds = await menu.boundingBox();
    if (!originalBounds) throw new Error("Application menu has no layout bounds");
    await page.keyboard.press("ArrowRight");

    if (testInfo.project.name === "mobile-chromium") {
      await expect(menu.getByRole("menuitem", { name: "Back to Edit" })).toBeVisible();
      await expect(preview.getByRole("menu")).toHaveCount(1);
      await expect(menu.getByRole("menuitem", { name: "New File" })).toBeHidden();

      const stackedBounds = await menu.boundingBox();
      if (!stackedBounds) throw new Error("Stacked menu has no layout bounds");
      expect(stackedBounds.x).toBeCloseTo(originalBounds.x);
      expect(stackedBounds.width).toBeCloseTo(originalBounds.width);
    } else {
      await expect(page.getByRole("menu", { name: "Edit", exact: true })).toBeVisible();
    }

    await page.keyboard.press("ArrowLeft");
    await expect(editItem).toHaveAttribute("aria-expanded", "false");
    await expect(menu).toBeFocused();
    await expect(menu).toHaveAttribute("aria-activedescendant", editId);

    await page.keyboard.press("ArrowRight");
    if (testInfo.project.name === "mobile-chromium") {
      await expect(menu.getByRole("menuitem", { name: "Back to Edit" })).toBeVisible();
    } else {
      await expect(editItem).toHaveAttribute("aria-expanded", "true");
    }
    await page.keyboard.press("Escape");
    await expect(editItem).toHaveAttribute("aria-expanded", "false");
    await expect(menu).toBeFocused();
    await expect(menu).toHaveAttribute("aria-activedescendant", editId);
  });
});
