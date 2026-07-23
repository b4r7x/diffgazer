import { expect, test } from "@playwright/test";

test("the results panes swap without horizontal overflow at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/testing/fixtures/results-layout.html?view=results");

  const viewport = page.getByRole("region", { name: "Review result panes" });
  const details = page.getByRole("complementary", { name: "Issue details" });
  const issueListPane = page.getByRole("complementary", { name: "Issue list" });
  const issueList = page.getByRole("listbox");
  const listBody = page.locator("[data-list-body]");
  await expect(viewport).toBeVisible();
  await expect(issueListPane).toBeVisible();
  await expect(issueList).toBeFocused();
  // Mobile pane-swap: the issue list is the only visible pane until an issue opens.
  await expect(details).toBeHidden();

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

  const mainBounds = await page.evaluate(() => {
    const main = document.querySelector("main");
    if (!(main instanceof HTMLElement)) throw new Error("Missing main");
    return { clientWidth: main.clientWidth, scrollWidth: main.scrollWidth };
  });
  expect(mainBounds.scrollWidth).toBe(mainBounds.clientWidth);

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

test("mobile shows one review pane at a time", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== "mobile-chromium",
    "pane-swap is the coarse-pointer layout; desktop stays side-by-side",
  );
  await page.goto("/testing/fixtures/results-layout.html?view=results");

  const issueList = page.getByRole("listbox", { name: "Issues" });
  const details = page.getByRole("complementary", { name: "Issue details" });
  const listBody = page.locator("[data-list-body]");
  const options = issueList.getByRole("option");

  // On load the details pane is hidden and only the list is shown.
  await expect(issueList).toBeVisible();
  await expect(details).toBeHidden();

  // The full-height list fits far more than the pre-fix cramped window (~2 rows).
  const bodyBox = await listBody.boundingBox();
  expect(bodyBox).not.toBeNull();
  const fullyVisibleRows = await options.evaluateAll(
    (rows, bounds) =>
      rows.filter((row) => {
        const rect = row.getBoundingClientRect();
        return (
          rect.height > 0 && rect.top >= bounds.top - 0.5 && rect.bottom <= bounds.bottom + 0.5
        );
      }).length,
    { top: bodyBox?.y ?? 0, bottom: (bodyBox?.y ?? 0) + (bodyBox?.height ?? 0) },
  );
  expect(fullyVisibleRows).toBeGreaterThanOrEqual(5);

  // Tapping an issue swaps to the details pane with a visible Back control.
  await options.first().click();
  await expect(issueList).toBeHidden();
  await expect(details).toBeVisible();
  const back = page.getByRole("button", { name: /issues/i });
  await expect(back).toBeVisible();

  // Activating Back returns to the list.
  await back.click();
  await expect(issueList).toBeVisible();
  await expect(details).toBeHidden();
});
