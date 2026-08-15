import { expect, type Locator, type Page, test } from "@playwright/test";

async function readScrollMetrics(region: Locator) {
  return region.evaluate((element) => ({
    scrollTop: element.scrollTop,
    scrollLeft: element.scrollLeft,
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
  }));
}

async function focusRegion(page: Page, name: string) {
  const region = page.getByRole("region", { name });
  await region.focus();
  await expect(region).toBeFocused();
  return region;
}

test.describe("ScrollArea public examples", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 720 });
    await page.goto("/testing/fixtures/scroll-area-examples.html");
  });

  test("keyboard example overflows vertically and scrolls with documented keys", async ({
    page,
  }) => {
    const region = await focusRegion(page, "Commit log");
    const before = await readScrollMetrics(region);

    expect(before.scrollHeight).toBeGreaterThan(before.clientHeight);
    expect(before.scrollTop).toBe(0);

    await page.keyboard.press("ArrowDown");
    const afterArrow = await readScrollMetrics(region);
    expect(afterArrow.scrollTop).toBeGreaterThan(0);

    await page.keyboard.press("PageDown");
    const afterPage = await readScrollMetrics(region);
    expect(afterPage.scrollTop).toBeGreaterThan(afterArrow.scrollTop);

    await page.keyboard.press("End");
    const afterEnd = await readScrollMetrics(region);
    expect(afterEnd.scrollTop).toBe(afterEnd.scrollHeight - afterEnd.clientHeight);

    await page.keyboard.press("Home");
    const afterHome = await readScrollMetrics(region);
    expect(afterHome.scrollTop).toBe(0);
  });

  test("horizontal example overflows on the x-axis and scrolls with arrow keys", async ({
    page,
  }) => {
    const region = await focusRegion(page, "Horizontal strip");
    const before = await readScrollMetrics(region);

    expect(before.scrollWidth).toBeGreaterThan(before.clientWidth);
    expect(before.scrollLeft).toBe(0);

    await page.keyboard.press("ArrowRight");
    const afterArrow = await readScrollMetrics(region);
    expect(afterArrow.scrollLeft).toBeGreaterThan(0);

    await page.keyboard.press("End");
    const afterEnd = await readScrollMetrics(region);
    expect(afterEnd.scrollLeft).toBe(afterEnd.scrollWidth - afterEnd.clientWidth);

    await page.keyboard.press("Home");
    const afterHome = await readScrollMetrics(region);
    expect(afterHome.scrollLeft).toBe(0);
  });

  test("both-axis example overflows on both axes and scrolls independently", async ({ page }) => {
    const region = await focusRegion(page, "Two-axis demo");
    const before = await readScrollMetrics(region);

    expect(before.scrollHeight).toBeGreaterThan(before.clientHeight);
    expect(before.scrollWidth).toBeGreaterThan(before.clientWidth);
    expect(before.scrollTop).toBe(0);
    expect(before.scrollLeft).toBe(0);

    await page.keyboard.press("ArrowDown");
    const afterVertical = await readScrollMetrics(region);
    expect(afterVertical.scrollTop).toBeGreaterThan(0);
    expect(afterVertical.scrollLeft).toBe(0);

    await page.keyboard.press("ArrowRight");
    const afterBoth = await readScrollMetrics(region);
    expect(afterBoth.scrollLeft).toBeGreaterThan(0);
    expect(afterBoth.scrollTop).toBe(afterVertical.scrollTop);

    await page.keyboard.press("End");
    const afterEnd = await readScrollMetrics(region);
    expect(afterEnd.scrollTop).toBe(afterEnd.scrollHeight - afterEnd.clientHeight);
    expect(afterEnd.scrollLeft).toBeGreaterThan(afterBoth.scrollLeft);
  });
});
