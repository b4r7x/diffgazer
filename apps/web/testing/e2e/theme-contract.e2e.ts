import { expect, test } from "@playwright/test";

async function readToken(page: import("@playwright/test").Page, property: string): Promise<string> {
  return page.evaluate(
    (token) => getComputedStyle(document.documentElement).getPropertyValue(token).trim(),
    property,
  );
}

test.describe("theme contract", () => {
  test("applies the light palette and control-edge tokens in the browser", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/testing/fixtures/theme-contract.html", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));

    const controlBorder = await readToken(page, "--control-border");
    const cornerLabel = await readToken(page, "--corner-label-foreground");
    const surface2 = await readToken(page, "--surface-2");

    expect(controlBorder).toBe("#6e6e6e");
    expect(cornerLabel).toBe("#525960");
    expect(surface2).toBe("#eaedf1");
  });

  test("applies increased-contrast overrides in the browser", async ({ page }) => {
    await page.emulateMedia({ contrast: "more" });
    await page.goto("/testing/fixtures/theme-contract.html", { waitUntil: "domcontentloaded" });

    const baseDim = await readToken(page, "--base-dim");
    const borderStrong = await readToken(page, "--border-strong");
    const baseBorder = await readToken(page, "--base-border");

    expect(baseDim).toBe("#b3b3b3");
    expect(borderStrong).toBe("#999999");
    expect(baseBorder).toBe("#777777");
  });
});
