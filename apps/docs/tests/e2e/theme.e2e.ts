import { expect, test } from "@playwright/test";

test.describe("Docs theme", () => {
  test("the chrome toggle switches the whole site and persists", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    // The toggle's onClick is attached only after React hydration; Playwright's
    // actionability auto-wait does not wait for hydration, so retry the click
    // until the handler is wired and the theme actually flips.
    await expect(async () => {
      await page.getByRole("button", { name: /switch to light theme/i }).click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    }).toPass();

    const bodyBackground = await page.evaluate(
      () => getComputedStyle(document.body).backgroundColor,
    );
    // Light theme background (#f7f8f5) is far from the dark #0a0a0a; assert it is a light color.
    expect(bodyBackground).not.toBe("rgb(10, 10, 10)");

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });

  test("editing a playground primitive re-tints the preview", async ({ page }) => {
    await page.goto("/ui/theme");
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();

    const bgInput = page.getByLabel("Color picker for --base-bg");
    await expect(bgInput).toBeVisible();

    const preview = page.locator("[data-slot='panel'] [data-theme]").first();
    const previewBackground = () =>
      preview
        .locator(":scope > div")
        .first()
        .evaluate((el) => getComputedStyle(el).backgroundColor);
    const before = await previewBackground();

    // The color input's onChange is wired only after React hydration; the
    // first fill can land before the handler attaches, so re-fill until the
    // edit reaches the preview and re-tints it.
    await expect(async () => {
      await bgInput.fill("#3311aa");
      expect(await previewBackground()).not.toBe(before);
    }).toPass();
  });
});
