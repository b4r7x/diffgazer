import { expect, test } from "@playwright/test";

const COLLISION_PADDING = 8;

test("a panel taller than the viewport scrolls inside its own box instead of clipping", async ({
  page,
}) => {
  await page.setViewportSize({ width: 900, height: 600 });
  await page.goto("/testing/fixtures/floating-panel-overflow.html");
  await page.getByRole("button", { name: "Open tall panel" }).click();

  const panel = page.getByRole("dialog", { name: "Tall panel" });
  await expect(panel).toBeVisible();

  const box = await panel.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      overflowY: style.overflowY,
      maxHeight: Number.parseFloat(style.maxHeight),
      offsetHeight: (element as HTMLElement).offsetHeight,
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      viewportHeight: window.innerHeight,
    };
  });

  expect(box.overflowY).toBe("auto");
  // The cap must describe real room, never the collapsed 0px the no-fit fallback used to emit.
  expect(box.maxHeight).toBeGreaterThan(0);
  expect(box.offsetHeight).toBeLessThanOrEqual(box.maxHeight);
  expect(box.offsetHeight).toBeLessThanOrEqual(box.viewportHeight - 2 * COLLISION_PADDING);
  // The rows are several times the panel's height, so the cap is only honest if they scroll.
  expect(box.scrollHeight).toBeGreaterThan(box.clientHeight);

  const scrolled = await panel.evaluate((element) => {
    element.scrollTop = 120;
    return element.scrollTop;
  });
  expect(scrolled).toBeGreaterThan(0);

  await expect(panel.getByText("Row 60")).toBeAttached();
});
