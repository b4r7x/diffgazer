import { expect, test } from "@playwright/test";

/**
 * Below `lg` the home hero and the session demo stack in one column, so the hero's
 * vertical rhythm alone decides where the session panel lands. If the panel starts
 * at the footer the page reads as a dead end on a phone: the reader sees a wordmark,
 * a directory, and a hard bottom edge, with no sign that the demo below exists.
 *
 * The assertion is relative to the footer rather than to the viewport so it keeps
 * meaning if the chrome above `main` changes height, and it runs at 375x667 (iPhone
 * SE) because that is the shortest phone the docs target.
 */
const SE_VIEWPORT = { width: 375, height: 667 };

/** Session panel height that has to clear the footer for the page to read as scrollable. */
const MIN_PEEK = 16;

test("keeps the session panel peeking above the footer on a 375x667 phone", async ({ page }) => {
  await page.setViewportSize(SE_VIEWPORT);
  await page.goto("/");

  const sessionPanel = page.locator('[data-slot="panel"]', {
    has: page.getByRole("img", { name: "Session terminal" }),
  });
  const footer = page.locator("footer");
  await expect(sessionPanel).toBeVisible();
  await expect(footer).toBeVisible();

  // This is the first-paint fold, not a view someone scrolled to.
  expect(await page.locator("#main-content").evaluate((node) => node.scrollTop)).toBe(0);

  const panelBox = await sessionPanel.boundingBox();
  const footerBox = await footer.boundingBox();
  expect(panelBox).not.toBeNull();
  expect(footerBox).not.toBeNull();

  const peek = (footerBox?.y ?? 0) - (panelBox?.y ?? 0);
  expect(peek, "session panel height visible above the footer").toBeGreaterThanOrEqual(MIN_PEEK);
});
