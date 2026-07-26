import { expect, test } from "@playwright/test";

/**
 * The docs chrome branches on `(pointer: coarse)`. jsdom always reports a fine
 * pointer, so these assertions need a real browser: `chromium` proves the fine
 * branch, `mobile-chromium` proves the touch branch. The branch is chosen by the
 * Playwright project and the media query is then *asserted* against it — reading
 * the media query as an input would let the suite pass silently if the device
 * ever stopped reporting a coarse pointer.
 */
const MOBILE_PROJECT = "mobile-chromium";

/**
 * `clamp(0.5rem, 2.1cqw, 1rem)` on the hero wordmark. Neither project sits on a
 * clamp endpoint: the `2.1cqw` term is the active one at both container widths
 * (~572px on Desktop Chrome, ~396px on a Pixel 7), so each project pins the value
 * its own container query produces. A range covering the whole clamp would be
 * satisfied by every value the clamp can emit and would prove nothing.
 */
const EXPECTED_WORDMARK_FONT_SIZE = { chromium: 11.97, [MOBILE_PROJECT]: 8.27 } as const;
const WORDMARK_FONT_SIZE_TOLERANCE = 0.5;

test.describe("Docs coarse-pointer chrome", () => {
  test("offers the search close button on touch and the Esc hint on a fine pointer", async ({
    page,
  }, testInfo) => {
    const coarse = testInfo.project.name === MOBILE_PROJECT;
    await page.goto("/");

    expect(await page.evaluate(() => window.matchMedia("(pointer: coarse)").matches)).toBe(coarse);

    await page.getByRole("button", { name: /search docs/i }).click();
    const search = page.getByRole("combobox", { name: /command search/i });
    await expect(search).toBeVisible();

    const palette = page.getByRole("dialog");
    const close = palette.getByRole("button", { name: "Close search" });

    if (!coarse) {
      await expect(close).toBeHidden();
      await expect(palette.getByText("Esc", { exact: true })).toBeVisible();
      return;
    }

    await expect(close).toBeVisible();
    await expect(close).toHaveText("[ close ]");

    await search.fill("button");
    await expect(page.getByRole("option").first()).toBeVisible();

    // One tap closes outright — it is a close button, not an Esc key stand-in.
    await close.click();
    await expect(search).toBeHidden();
  });

  test("scales the hero wordmark with its container and never clips it", async ({
    page,
  }, testInfo) => {
    await page.goto("/");

    // Scoped to main: the status bar carries the same ascii wordmark (laid out
    // at a fixed 10px step and scaled by transform), and this test is about the
    // hero's container-query scaling.
    const wordmark = page.getByRole("main").getByRole("img", { name: "diffgazer" });
    await expect(wordmark).toBeVisible();

    const projectName = testInfo.project.name as keyof typeof EXPECTED_WORDMARK_FONT_SIZE;
    const expectedFontSize = EXPECTED_WORDMARK_FONT_SIZE[projectName];
    expect(expectedFontSize, `no expected wordmark size for project ${projectName}`).toBeDefined();

    const fontSize = await wordmark.evaluate((el) =>
      Number.parseFloat(window.getComputedStyle(el).fontSize),
    );
    expect(Math.abs(fontSize - expectedFontSize)).toBeLessThanOrEqual(WORDMARK_FONT_SIZE_TOLERANCE);

    const clippedBy = await wordmark.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(clippedBy).toBeLessThanOrEqual(1);
  });
});
