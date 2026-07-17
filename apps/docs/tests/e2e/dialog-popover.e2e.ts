import { expect, test } from "@playwright/test";

test.describe("Dialog with nested Popover", () => {
  test("Escape and focus exit each close one overlay layer", async ({ page }) => {
    await page.goto("/ui/components/dialog");

    await page.getByRole("button", { name: "Open nested overlay" }).click();
    const dialog = page.getByRole("dialog", { name: "Nested overlay" });
    const trigger = dialog.getByRole("button", { name: "Open popover" });
    const sibling = dialog.getByRole("button", { name: "Dialog sibling" });

    await trigger.click();
    let popover = dialog.getByRole("dialog", { name: "Nested popover" });
    await expect(popover).toBeVisible();
    await popover.getByRole("button", { name: "Popover action" }).focus();
    await page.keyboard.press("Escape");

    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(dialog).toBeVisible();
    await expect(trigger).toBeFocused();

    await trigger.click();
    popover = dialog.getByRole("dialog", { name: "Nested popover" });
    await expect(popover).toBeVisible();
    await sibling.focus();

    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(popover).toBeHidden();
    await expect(dialog).toBeVisible();
    await expect(sibling).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });
});
