import { expect, test } from "@playwright/test";

const tablists = [
  { name: "Wrapped pill tabs", variant: "pill" },
  { name: "Wrapped underline tabs", variant: "underline" },
] as const;

test.describe("Tabs reflow", () => {
  test("wraps pill and underline rows without horizontal page scroll", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto("/ui/components/tabs");
    await page.addStyleTag({
      content: `
        * {
          line-height: 1.5 !important;
          letter-spacing: 0.12em !important;
          word-spacing: 0.16em !important;
        }
      `,
    });

    for (const { name, variant } of tablists) {
      const tablist = page.getByRole("tablist", { name });
      await expect(tablist).toBeVisible();
      await expect(tablist).toHaveAttribute("data-wrap", "true");

      const geometry = await tablist.evaluate((element) => {
        const tabs = Array.from(element.querySelectorAll<HTMLElement>('[role="tab"]'));
        const rows = new Set(tabs.map((tab) => Math.round(tab.getBoundingClientRect().top)));
        const rect = element.getBoundingClientRect();
        return {
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
          left: rect.left,
          right: rect.right,
          rowCount: rows.size,
          viewportWidth: window.innerWidth,
          documentWidth: document.documentElement.scrollWidth,
        };
      });

      expect(geometry.rowCount).toBeGreaterThan(1);
      expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
      expect(geometry.left).toBeGreaterThanOrEqual(0);
      expect(geometry.right).toBeLessThanOrEqual(geometry.viewportWidth + 1);
      expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);

      const tabs = tablist.getByRole("tab");
      const first = tabs.nth(0);
      const second = tabs.nth(1);
      await first.focus();
      await page.keyboard.press("ArrowRight");
      await expect(second).toBeFocused();
      await expect(second).toHaveAttribute("aria-selected", "true");
      expect(await page.evaluate(() => window.scrollX)).toBe(0);

      const treatment = await second.evaluate((active, currentVariant) => {
        const inactive = active.parentElement?.querySelector<HTMLElement>(
          '[role="tab"][data-state="inactive"]',
        );
        if (!inactive) throw new Error("Expected an inactive sibling tab");
        const activeStyle = getComputedStyle(active);
        const inactiveStyle = getComputedStyle(inactive);
        return currentVariant === "pill"
          ? {
              active: activeStyle.backgroundColor,
              inactive: inactiveStyle.backgroundColor,
            }
          : {
              active: `${activeStyle.borderBottomWidth} ${activeStyle.borderBottomColor}`,
              inactive: `${inactiveStyle.borderBottomWidth} ${inactiveStyle.borderBottomColor}`,
            };
      }, variant);
      expect(treatment.active).not.toBe(treatment.inactive);
    }
  });
});
