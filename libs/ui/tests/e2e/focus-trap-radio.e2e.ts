import { expect, test } from "@playwright/test";

test("Tab reaches an eligible radio when its checked peer has negative tabindex", async ({
  page,
}) => {
  await page.goto("/tests/fixtures/focus-trap-radio.html?direction=forward");
  const start = page.getByRole("button", { name: "Forward start" });
  const eligiblePeer = page.getByRole("radio", { name: "Forward peer" });

  await start.focus();
  await page.keyboard.press("Tab");
  await expect(eligiblePeer).toBeFocused();

  await page.keyboard.press("Tab");
  await expect(start).toBeFocused();
});

test("Shift+Tab reaches an eligible radio when its checked peer has negative tabindex", async ({
  page,
}) => {
  await page.goto("/tests/fixtures/focus-trap-radio.html?direction=reverse");
  const eligiblePeer = page.getByRole("radio", { name: "Reverse peer" });
  const end = page.getByRole("button", { name: "Reverse end" });

  await end.focus();
  await page.keyboard.press("Shift+Tab");
  await expect(eligiblePeer).toBeFocused();

  await page.keyboard.press("Shift+Tab");
  await expect(end).toBeFocused();
});
