import { expect, test } from "@playwright/test";

test.describe("Parameter table reflow", () => {
  test("keeps a wide API table keyboard-scrollable without widening the page", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto("/ui/components/button");

    const table = page.getByRole("table").first();
    const scrollRegion = table.locator("..");
    const descriptionHeader = table.getByRole("columnheader", { name: "Description" });
    await expect(table).toBeVisible();
    await expect(scrollRegion).toHaveAttribute("tabindex", "0");

    const initialGeometry = await scrollRegion.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }));
    expect(initialGeometry.scrollWidth).toBeGreaterThan(initialGeometry.clientWidth);
    expect(initialGeometry.documentWidth).toBeLessThanOrEqual(initialGeometry.viewportWidth);

    await scrollRegion.focus();
    await expect(scrollRegion).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect
      .poll(() => scrollRegion.evaluate((element) => element.scrollLeft))
      .toBeGreaterThan(0);
    await scrollRegion.evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
    });

    const finalGeometry = await scrollRegion.evaluate((element) => {
      const lastHeader = element.querySelector<HTMLElement>("th:last-child");
      if (!lastHeader) throw new Error("Expected a final parameter-table column");
      const regionRect = element.getBoundingClientRect();
      const headerRect = lastHeader.getBoundingClientRect();
      return {
        headerLeft: headerRect.left,
        headerRight: headerRect.right,
        regionLeft: regionRect.left,
        regionRight: regionRect.right,
        scrollLeft: element.scrollLeft,
      };
    });
    expect(finalGeometry.scrollLeft).toBeGreaterThan(0);
    expect(finalGeometry.headerLeft).toBeLessThan(finalGeometry.regionRight);
    expect(finalGeometry.headerRight).toBeGreaterThan(finalGeometry.regionLeft);
    expect(finalGeometry.headerRight).toBeLessThanOrEqual(finalGeometry.regionRight + 1);
    await expect(descriptionHeader).toBeVisible();
  });
});
