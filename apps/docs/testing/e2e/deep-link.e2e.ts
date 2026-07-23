import { expect, test } from "@playwright/test";

test.describe("Docs deep links", () => {
  test("cold-loads a component page through the $lib route", async ({ page }) => {
    const response = await page.goto("/ui/components/button");

    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: "Button" })).toBeVisible();
    await expect(page.getByText(/terminal-inspired button/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Documentation page not found" })).toHaveCount(
      0,
    );
    await expect(page.getByRole("heading", { name: "Page not found" })).toHaveCount(0);
  });
});
