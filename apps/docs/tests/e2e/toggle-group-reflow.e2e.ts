import { expect, type Locator, test } from "@playwright/test";

interface ItemVisualState {
  background: string;
  color: string;
}

async function readVisualState(item: Locator): Promise<ItemVisualState> {
  return item.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      background: style.backgroundColor,
      color: style.color,
    };
  });
}

async function expectSelectedTreatment(
  selected: Locator,
  unselected: Locator,
): Promise<{ selected: ItemVisualState; unselected: ItemVisualState }> {
  await expect
    .poll(async () => {
      const [selectedStyle, unselectedStyle] = await Promise.all([
        readVisualState(selected),
        readVisualState(unselected),
      ]);
      return {
        background: selectedStyle.background !== unselectedStyle.background,
        color: selectedStyle.color !== unselectedStyle.color,
      };
    })
    .toEqual({ background: true, color: true });

  const [selectedStyle, unselectedStyle] = await Promise.all([
    readVisualState(selected),
    readVisualState(unselected),
  ]);
  return { selected: selectedStyle, unselected: unselectedStyle };
}

async function expectWrappedWithoutOverflow(group: Locator): Promise<void> {
  const geometry = await group.evaluate((element) => {
    const items = Array.from(element.querySelectorAll<HTMLElement>("button"));
    const rows = new Set(items.map((item) => Math.round(item.getBoundingClientRect().top)));
    const centersHitItems = items.every((item) => {
      const rect = item.getBoundingClientRect();
      const hit = item.ownerDocument.elementFromPoint(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
      );
      return hit === item || item.contains(hit);
    });
    const rect = element.getBoundingClientRect();
    return {
      centersHitItems,
      groupLeft: rect.left,
      groupRight: rect.right,
      rowCount: rows.size,
      viewportWidth: element.ownerDocument.documentElement.clientWidth,
      documentWidth: element.ownerDocument.documentElement.scrollWidth,
    };
  });

  expect(geometry.rowCount).toBeGreaterThan(1);
  expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
  expect(geometry.groupLeft).toBeGreaterThanOrEqual(-0.5);
  expect(geometry.groupRight).toBeLessThanOrEqual(geometry.viewportWidth + 0.5);
  expect(geometry.centersHitItems).toBe(true);
}

test.describe("ToggleGroup reflow", () => {
  test.use({ viewport: { width: 320, height: 900 } });

  test("wraps default and pill variants while preserving arrow navigation", async ({ page }) => {
    await page.goto("/ui/components/toggle-group");
    await expect(page.getByRole("heading", { level: 1, name: /toggle group/i })).toBeVisible();
    await page.addStyleTag({
      content: '[aria-label^="File filter"] > button { letter-spacing: 0.12em; }',
    });

    const defaultGroup = page.getByRole("radiogroup", {
      name: "File filter (default variant)",
    });
    const pillGroup = page.getByRole("radiogroup", { name: "File filter (pill variant)" });

    await defaultGroup.scrollIntoViewIfNeeded();
    await expectWrappedWithoutOverflow(defaultGroup);
    await pillGroup.scrollIntoViewIfNeeded();
    await expectWrappedWithoutOverflow(pillGroup);
    await expect(pillGroup.locator('[data-slot="toggle-group-pill"]')).toHaveCount(0);

    const modified = pillGroup.getByRole("radio", { name: "Modified" });
    const deleted = pillGroup.getByRole("radio", { name: "Deleted" });
    await expect(modified).toHaveAttribute("aria-checked", "true");
    await expect(deleted).toHaveAttribute("aria-checked", "false");
    const before = await expectSelectedTreatment(modified, deleted);

    await modified.focus();
    await page.keyboard.press("ArrowRight");

    await expect(deleted).toBeFocused();
    await expect(deleted).toHaveAttribute("aria-checked", "true");
    await expect(modified).toHaveAttribute("aria-checked", "false");
    await expectSelectedTreatment(deleted, modified);
    await expect.poll(() => readVisualState(deleted)).toEqual(before.selected);
    await expect.poll(() => readVisualState(modified)).toEqual(before.unselected);
    expect(await page.evaluate(() => document.scrollingElement?.scrollLeft ?? 0)).toBe(0);
    await expectWrappedWithoutOverflow(pillGroup);
  });
});
