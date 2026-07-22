import { expect, type Locator, test } from "@playwright/test";

// jsdom cannot lay out the subgrid, so this reproduces the real-browser contract the
// deleted unit test could only approximate by parsing diff-view.css: a row with a long
// added/removed line must keep its state tint spanning the full scrollable width, not
// just the initially visible viewport, once the diff is scrolled horizontally.
async function readTintAtFarEdge(row: Locator, cssVariable: string) {
  return row.evaluate((element, variableName) => {
    const container = element.closest('[data-slot="diff-view-rows"]');
    const diffView = element.closest('[data-slot="diff-view"]');
    if (!container || !diffView) return null;

    const containerRect = container.getBoundingClientRect();
    const rowRect = element.getBoundingClientRect();
    const elementAtFarEdge = document.elementFromPoint(
      containerRect.right - 1,
      rowRect.top + rowRect.height / 2,
    );
    if (!elementAtFarEdge || !element.contains(elementAtFarEdge)) return null;

    // Compute the expected tint the same way the CSS derives it, so the assertion
    // never hardcodes a browser-specific color-mix() output.
    const referenceSwatch = document.createElement("div");
    referenceSwatch.style.background = `var(${variableName})`;
    diffView.appendChild(referenceSwatch);
    const expectedColor = getComputedStyle(referenceSwatch).backgroundColor;
    referenceSwatch.remove();

    return { actualColor: getComputedStyle(element).backgroundColor, expectedColor };
  }, cssVariable);
}

test.describe("DiffView horizontal scroll row tint", () => {
  test("keeps the added and removed row tint spanning the far scrolled edge", async ({ page }) => {
    await page.goto("/tests/fixtures/diff-view-horizontal-scroll.html");

    const rows = page.getByRole("region", { name: "Unified diff" });
    const addedRow = rows.locator('[data-row][data-state="added"]');
    const removedRow = rows.locator('[data-row][data-state="removed"]');
    await expect(addedRow).toBeVisible();
    await expect(removedRow).toBeVisible();

    const { scrollWidth, clientWidth } = await rows.evaluate((element) => ({
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
    }));
    expect(scrollWidth).toBeGreaterThan(clientWidth);

    for (const row of [addedRow, removedRow]) {
      const rowScrollWidth = await row.evaluate((element) => element.scrollWidth);
      expect(rowScrollWidth).toBeGreaterThanOrEqual(scrollWidth - 1);
    }

    await rows.evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
    });

    const addedTint = await readTintAtFarEdge(addedRow, "--diff-added-bg");
    const removedTint = await readTintAtFarEdge(removedRow, "--diff-removed-bg");

    expect(addedTint, "added row should still be under the far scrolled edge").not.toBeNull();
    expect(removedTint, "removed row should still be under the far scrolled edge").not.toBeNull();
    expect(addedTint?.actualColor).toBe(addedTint?.expectedColor);
    expect(removedTint?.actualColor).toBe(removedTint?.expectedColor);
    expect(addedTint?.actualColor).not.toBe(removedTint?.actualColor);
  });
});
