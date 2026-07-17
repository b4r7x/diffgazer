import { expect, test } from "@playwright/test";

test.describe("Callout", () => {
  test("dismiss skips a recovery control under a hidden ancestor", async ({ page }) => {
    await page.goto("/ui/components/callout");
    await expect(page.getByRole("heading", { level: 1, name: /callout/i })).toBeVisible();

    const callout = page.locator('[data-slot="callout"]').filter({ hasText: "Controlled Callout" });
    const dismiss = callout.getByRole("button", { name: "Dismiss" });

    await callout.evaluate((root) => {
      const hiddenAncestor = document.createElement("div");
      hiddenAncestor.style.display = "none";
      const hiddenTarget = document.createElement("button");
      hiddenTarget.type = "button";
      hiddenTarget.textContent = "Hidden recovery target";
      hiddenAncestor.append(hiddenTarget);

      const visibleTarget = document.createElement("button");
      visibleTarget.type = "button";
      visibleTarget.textContent = "Visible recovery target";
      root.after(hiddenAncestor, visibleTarget);
    });

    const visibleTarget = page.getByRole("button", { name: "Visible recovery target" });
    await dismiss.focus();
    await expect(dismiss).toBeFocused();
    await dismiss.press("Enter");

    await expect(callout).toHaveCount(0);
    await expect(visibleTarget).toBeFocused();
  });
});
