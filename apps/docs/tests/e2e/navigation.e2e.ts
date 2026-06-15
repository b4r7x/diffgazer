import { expect, test } from "@playwright/test";

test.describe("Docs navigation", () => {
  test("desktop sidebar links navigate between docs pages", async ({ page }) => {
    await page.goto("/ui/components/button");
    await expect(page.getByRole("heading", { level: 1, name: "Button" })).toBeVisible();

    const sidebar = page.getByRole("complementary", { name: /sidebar navigation/i });
    await expect(sidebar).toBeVisible();

    await sidebar.getByRole("link", { name: "Accordion" }).click();

    await expect(page).toHaveURL(/\/ui\/components\/accordion$/);
    await expect(page.getByRole("heading", { level: 1, name: "Accordion" })).toBeVisible();
  });

  test("mobile drawer opens, navigates, and closes", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/ui/components/button");
    await expect(page.getByRole("heading", { level: 1, name: "Button" })).toBeVisible();

    const menuButton = page.getByRole("button", { name: /open navigation menu/i });
    await expect(menuButton).toBeVisible();
    await menuButton.click();

    await expect(page.getByRole("button", { name: /close sidebar navigation/i })).toBeVisible();

    const sidebar = page.getByRole("complementary", { name: /sidebar navigation/i });
    await sidebar.getByRole("link", { name: "Accordion" }).click();

    await expect(page).toHaveURL(/\/ui\/components\/accordion$/);
    await expect(page.getByRole("heading", { level: 1, name: "Accordion" })).toBeVisible();
    await expect(page.getByRole("button", { name: /close sidebar navigation/i })).toBeHidden();
    await expect(menuButton).toHaveAttribute("aria-expanded", "false");
  });
});
