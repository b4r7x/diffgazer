import { expect, type Page, test } from "@playwright/test";

const LIGHT_BACKGROUND = "rgb(247, 248, 245)";
const THEME_COLOR_DARK = "#0a0a0a";
const THEME_COLOR_LIGHT = "#f7f8f5";
/** Verbatim slice of the head bootstrap; no other inline script reads this key. */
const THEME_BOOTSTRAP_MARKER = 'localStorage.getItem("@diffgazer/docs-theme")';
/**
 * These specs run against the built docs, so React ships minified and a mismatch
 * says only "Minified React error #418; visit https://react.dev/errors/418". The
 * readable wordings still appear under a development runtime, so match both.
 */
const HYDRATION_ERROR = /hydrat|did not match|react\.dev\/errors\//i;

/**
 * React 19 hands recoverable errors to `reportError`, which surfaces as an
 * uncaught page error rather than a console call, so listening on `console`
 * alone would leave this assertion unable to fail.
 */
function collectHydrationErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (HYDRATION_ERROR.test(message.text())) errors.push(message.text());
  });
  page.on("pageerror", (error) => {
    if (HYDRATION_ERROR.test(error.message)) errors.push(error.message);
  });
  return errors;
}

function themeToggle(page: Page) {
  return page.getByRole("button", { name: /^theme:/i });
}

function documentTheme(page: Page) {
  return page.locator("html");
}

function colorScheme(page: Page) {
  return page.evaluate(() => document.documentElement.style.colorScheme);
}

/**
 * The toggle's onClick is attached only after React hydration, and Playwright's
 * actionability auto-wait does not wait for hydration. Retry the first click of
 * a spec until the cycle actually advances off the system theme.
 */
async function clickUntilHydrated(page: Page) {
  await expect(async () => {
    await themeToggle(page).click();
    await expect(themeToggle(page)).toHaveText(/dark/i);
  }).toPass();
}

test.describe("Docs theme", () => {
  test("the chrome toggle cycles dark, light, and system, and persists the choice", async ({
    page,
  }) => {
    await page.goto("/");
    // No stored preference: a first-time reader follows the OS, emulated dark.
    await expect(themeToggle(page)).toHaveText(/system/i);
    await expect(documentTheme(page)).toHaveAttribute("data-theme", "dark");

    await clickUntilHydrated(page);
    await expect(documentTheme(page)).toHaveAttribute("data-theme", "dark");

    await themeToggle(page).click();
    await expect(documentTheme(page)).toHaveAttribute("data-theme", "light");
    // Light theme background is --base-bg: #f7f8f5.
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(
      LIGHT_BACKGROUND,
    );

    await page.reload();
    await expect(documentTheme(page)).toHaveAttribute("data-theme", "light");
    await expect(themeToggle(page)).toHaveText(/light/i);

    await themeToggle(page).click();
    await expect(themeToggle(page)).toHaveText(/system/i);
    await expect(documentTheme(page)).toHaveAttribute("data-theme", "dark");
  });

  test("a pinned theme outranks the OS scheme across a reload", async ({ page }) => {
    await page.goto("/");
    await clickUntilHydrated(page);
    await expect(documentTheme(page)).toHaveAttribute("data-theme", "dark");

    await page.emulateMedia({ colorScheme: "light" });
    await expect(documentTheme(page)).toHaveAttribute("data-theme", "dark");

    await page.reload();
    await expect(documentTheme(page)).toHaveAttribute("data-theme", "dark");
    await expect(themeToggle(page)).toHaveText(/dark/i);
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).not.toBe(
      LIGHT_BACKGROUND,
    );
  });

  test("the system theme follows a live OS change without a reload", async ({ page }) => {
    await page.goto("/");

    // Cycle all the way back to the system theme; the first click doubles as the
    // hydration gate, so the media listener is attached by the time it lands.
    await clickUntilHydrated(page);
    await themeToggle(page).click();
    await themeToggle(page).click();
    await expect(themeToggle(page)).toHaveText(/system/i);
    await expect(documentTheme(page)).toHaveAttribute("data-theme", "dark");

    await page.emulateMedia({ colorScheme: "light" });
    await expect(documentTheme(page)).toHaveAttribute("data-theme", "light");
    await expect(themeToggle(page)).toHaveText(/system/i);
    expect(await colorScheme(page)).toBe("light");

    await page.emulateMedia({ colorScheme: "dark" });
    await expect(documentTheme(page)).toHaveAttribute("data-theme", "dark");
    expect(await colorScheme(page)).toBe("dark");
  });

  test("a first-time reader on a light OS lands on the light theme", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");

    await expect(documentTheme(page)).toHaveAttribute("data-theme", "light");
    await expect(themeToggle(page)).toHaveText(/system/i);
    expect(await colorScheme(page)).toBe("light");
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
      "content",
      THEME_COLOR_LIGHT,
    );
  });

  test("the browser chrome color tracks the active theme", async ({ page }) => {
    await page.goto("/");
    const themeColor = page.locator('meta[name="theme-color"]');
    await expect(themeColor).toHaveAttribute("content", THEME_COLOR_DARK);

    await clickUntilHydrated(page);
    // Hydration must leave the meta the bootstrap added alone, not hoist a second.
    await expect(themeColor).toHaveCount(1);
    await themeToggle(page).click();

    await expect(documentTheme(page)).toHaveAttribute("data-theme", "light");
    await expect(themeColor).toHaveAttribute("content", THEME_COLOR_LIGHT);
  });

  test("the head bootstrap deletes itself and hydration finds no mismatch", async ({ page }) => {
    const hydrationErrors = collectHydrationErrors(page);

    const response = await page.goto("/");
    // Pin the served side too: without it, the removal check below would pass
    // just as happily against a document that never carried the bootstrap.
    expect((await response?.text()) ?? "").toContain(THEME_BOOTSTRAP_MARKER);

    await clickUntilHydrated(page);

    // ScriptOnce appends document.currentScript.remove(), so no inline head
    // script may still carry the bootstrap: not the served tag surviving, and
    // not React re-emitting one during hydration. Scoped by content rather than
    // by count because React hoists the client entry module into the head too.
    const inlineHeadScripts = await page.locator("head script:not([src])").allTextContents();
    expect(inlineHeadScripts.filter((text) => text.includes(THEME_BOOTSTRAP_MARKER))).toEqual([]);
    expect(hydrationErrors).toEqual([]);
  });

  test("editing a playground primitive re-tints the preview", async ({ page }) => {
    await page.goto("/ui/theme");
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();

    const bgInput = page.getByLabel("Color picker for --base-bg");
    await expect(bgInput).toBeVisible();

    const preview = page.getByRole("region", { name: "Preview" }).locator("[data-theme-preview]");
    const previewBackground = () => preview.evaluate((el) => getComputedStyle(el).backgroundColor);

    // The color input's onChange is wired only after React hydration; the
    // first fill can land before the handler attaches, so re-fill until the
    // edit reaches the preview and re-tints it.
    await expect(async () => {
      await bgInput.fill("#3311aa");
      expect(await previewBackground()).toBe("rgb(51, 17, 170)");
    }).toPass();
  });
});
