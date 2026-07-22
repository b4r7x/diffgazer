import { expect, test } from "@playwright/test";

test("the results panes stack without horizontal overflow at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/tests/fixtures/results-layout.html");

  const viewport = page.getByRole("region", { name: "Review result panes" });
  const details = page.getByRole("complementary", { name: "Issue details" });
  const issueListPane = page.getByRole("complementary", { name: "Issue list" });
  const issueList = page.getByRole("listbox");
  const listBody = page.locator("[data-list-body]");
  const detailsZone = page.getByRole("region", { name: "Issue details" });
  await expect(viewport).toBeVisible();
  await expect(details).toBeVisible();
  await expect(issueList).toBeFocused();

  const initial = await viewport.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(initial.clientWidth).toBeLessThanOrEqual(320);
  expect(initial.scrollWidth).toBe(initial.clientWidth);

  const listOverflow = await listBody.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(listOverflow.scrollWidth).toBe(listOverflow.clientWidth);

  await page.keyboard.press("Tab");
  await expect(detailsZone).toBeFocused();
  await expect(viewport).not.toBeFocused();

  await page.keyboard.press("Escape");
  await expect(issueList).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(detailsZone).toBeFocused();

  const final = await page.evaluate(() => {
    const main = document.querySelector("main");
    const list = document.querySelector('[data-pane="list"]');
    const details = document.querySelector('[data-pane="details"]');
    if (!(main instanceof HTMLElement)) throw new Error("Missing main");
    if (!(list instanceof HTMLElement)) throw new Error("Missing list pane");
    if (!(details instanceof HTMLElement)) throw new Error("Missing details pane");
    const listRect = list.getBoundingClientRect();
    const detailsRect = details.getBoundingClientRect();
    return {
      listBottom: listRect.bottom,
      detailsTop: detailsRect.top,
      detailsLeft: detailsRect.left,
      detailsRight: detailsRect.right,
      mainClientWidth: main.clientWidth,
      mainScrollWidth: main.scrollWidth,
    };
  });

  expect(final.detailsTop).toBeGreaterThanOrEqual(final.listBottom);
  expect(final.detailsLeft).toBeGreaterThanOrEqual(0);
  expect(final.detailsRight).toBeLessThanOrEqual(320);
  expect(final.mainScrollWidth).toBe(final.mainClientWidth);

  await page.getByRole("button", { name: /high severity/i }).click();
  const severityButtons = page.getByRole("button", { name: /severity/i });
  const filterBounds = await severityButtons.evaluateAll((buttons) =>
    buttons.map((button) => {
      const rect = button.getBoundingClientRect();
      return { height: rect.height, left: rect.left, right: rect.right };
    }),
  );
  const listBounds = await issueListPane.boundingBox();
  expect(listBounds).not.toBeNull();
  for (const bounds of filterBounds) {
    expect(bounds.height).toBeGreaterThanOrEqual(24);
    expect(bounds.left).toBeGreaterThanOrEqual(listBounds?.x ?? 0);
    expect(bounds.right).toBeLessThanOrEqual((listBounds?.x ?? 0) + (listBounds?.width ?? 0));
  }

  await page.setViewportSize({ width: 768, height: 640 });
  const desktopPanes = await Promise.all([issueListPane.boundingBox(), details.boundingBox()]);
  expect(desktopPanes[0]).not.toBeNull();
  expect(desktopPanes[1]).not.toBeNull();
  expect(desktopPanes[1]?.x).toBeGreaterThanOrEqual(
    (desktopPanes[0]?.x ?? 0) + (desktopPanes[0]?.width ?? 0),
  );
});
