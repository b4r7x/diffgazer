import { expect, test } from "@playwright/test";

test("the details pane remains horizontally reachable at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/tests/fixtures/results-layout.html");

  const viewport = page.getByRole("region", { name: "Review result panes" });
  const details = page.getByRole("complementary", { name: "Issue details" });
  const issueList = page.getByRole("listbox");
  const detailsZone = page.getByRole("region", { name: "Issue details" });
  await expect(viewport).toBeVisible();
  await expect(details).toBeVisible();
  await expect(issueList).toBeFocused();

  const initial = await viewport.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(initial.clientWidth).toBeLessThanOrEqual(320);
  expect(initial.scrollWidth).toBeGreaterThan(initial.clientWidth);

  await page.keyboard.press("Tab");
  await expect(detailsZone).toBeFocused();
  await expect(viewport).not.toBeFocused();

  await page.keyboard.press("Escape");
  await expect(issueList).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(detailsZone).toBeFocused();

  const final = await page.evaluate(() => {
    const main = document.querySelector("main");
    const viewport = document.querySelector('[data-viewport="review-results"]');
    const details = document.querySelector('[data-pane="details"]');
    if (!(main instanceof HTMLElement)) throw new Error("Missing main");
    if (!(viewport instanceof HTMLElement)) throw new Error("Missing review viewport");
    if (!(details instanceof HTMLElement)) throw new Error("Missing details pane");
    const detailsRect = details.getBoundingClientRect();
    return {
      detailsLeft: detailsRect.left,
      detailsRight: detailsRect.right,
      mainClientWidth: main.clientWidth,
      mainScrollWidth: main.scrollWidth,
      scrollLeft: viewport.scrollLeft,
    };
  });

  expect(final.scrollLeft).toBeGreaterThan(0);
  expect(final.detailsLeft).toBeLessThan(320);
  expect(final.detailsRight).toBeGreaterThan(0);
  expect(final.mainScrollWidth).toBe(final.mainClientWidth);
});
