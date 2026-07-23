import { expect, test } from "@playwright/test";

test("focus trap reaches an explicitly visible descendant and skips display-none content", async ({
  page,
}) => {
  await page.goto("/testing/fixtures/popover-focus.html?case=visibility-override-trap");

  const visibleOverride = page.getByRole("button", { name: "Visible override action" });
  const next = page.getByRole("button", { name: "Next action" });
  const displayNone = page.getByRole("button", {
    name: "Display none action",
    includeHidden: true,
  });
  const outside = page.getByRole("button", { name: "Outside trap" });

  await expect(visibleOverride).toBeFocused();
  await expect(displayNone).toBeHidden();

  await outside.focus();
  await expect(visibleOverride).toBeFocused();

  await page.keyboard.press("Tab");
  await expect(next).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(visibleOverride).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(next).toBeFocused();
  await expect(displayNone).not.toBeFocused();
});
