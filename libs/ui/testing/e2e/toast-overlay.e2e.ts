import { expect, type Locator, test } from "@playwright/test";

// The Toaster opts its region into the Popover API whenever toasts are visible,
// so every assertion below runs against a really-promoted top-layer region —
// the branch jsdom can only fake.
function expectPromoted(region: Locator) {
  return expect
    .poll(() => region.evaluate((element) => element.matches(":popover-open")))
    .toBe(true);
}

test("a promoted toast region stays clickable and keyboard reachable", async ({ page }) => {
  await page.goto("/testing/fixtures/toast-overlay.html");
  const opener = page.getByRole("button", { name: "Show toast" });
  const region = page.getByRole("region", { name: "Notifications" });
  const toast = page.getByRole("alert").filter({ hasText: "Page toast" });

  await opener.click();
  await expect(toast).toBeVisible();
  await expectPromoted(region);

  await opener.focus();
  await page.keyboard.press("F8");
  await expect(region).toBeFocused();

  // Escape ends the inspection instead of dismissing: focus returns to the
  // opener and the toasts stay up.
  await page.keyboard.press("Escape");
  await expect(opener).toBeFocused();
  await expect(toast).toBeVisible();

  await page.getByRole("button", { name: "Dismiss: Page toast" }).click();
  await expect(toast).toBeHidden();
});

// Clicking or focusing the region while a modal dialog is open is impossible by
// spec — a modal dialog blocks every element outside its subtree, top layer
// included — so the dialog case asserts what promotion actually buys: the
// toasts stay painted and keep owning Escape.
test("toasts survive a modal dialog and own Escape until the stack is empty", async ({ page }) => {
  await page.goto("/testing/fixtures/toast-overlay.html");
  const region = page.getByRole("region", { name: "Notifications" });
  const dialog = page.getByRole("dialog", { name: "Blocking dialog" });
  const pageToast = page.getByRole("alert").filter({ hasText: "Page toast" });
  const dialogToast = page.getByRole("alert").filter({ hasText: "Dialog toast" });

  await page.getByRole("button", { name: "Show toast" }).click();
  await expect(pageToast).toBeVisible();
  await expectPromoted(region);

  await region.evaluate((element) => {
    element.setAttribute("data-toggles", "");
    element.addEventListener("toggle", (event) => {
      const { oldState, newState } = event as ToggleEvent;
      element.setAttribute(
        "data-toggles",
        `${element.getAttribute("data-toggles")}${oldState}->${newState};`,
      );
    });
  });

  // showModal() raises the dialog above the already-open manual popover, so the
  // container's dialog[open] observer must hide and re-show the region to
  // rejoin the top layer above it. Only that close/open cycle makes the UA
  // report a toggle whose old and new state are both "open".
  await page.getByRole("button", { name: "Open dialog" }).click();
  await expect(dialog).toBeVisible();
  await expect(region).toHaveAttribute("data-toggles", "open->open;");
  await expect(pageToast).toBeVisible();
  await expectPromoted(region);

  // The Escape layer is document-level, so it fires from inside the dialog: it
  // clears the toast stack and consumes the key, leaving the dialog open.
  await page.keyboard.press("Escape");
  await expect(pageToast).toBeHidden();
  await expect(dialog).toBeVisible();

  // A toast raised while the dialog is already open promotes on first show.
  await page.getByRole("button", { name: "Show dialog toast" }).click();
  await expect(dialogToast).toBeVisible();
  await expectPromoted(region);

  await page.keyboard.press("Escape");
  await expect(dialogToast).toBeHidden();
  await expect(dialog).toBeVisible();

  // With no toasts left the layer stands down and Escape reaches the dialog.
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});
