import { expect, type Locator, test } from "@playwright/test";

async function getOutline(locator: Locator) {
  return locator.evaluate((element) => {
    const styles = getComputedStyle(element);
    return {
      width: Number.parseFloat(styles.outlineWidth),
      style: styles.outlineStyle,
      color: styles.outlineColor,
    };
  });
}

test.describe("Input forced-colors focus", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ forcedColors: "active" });
    await page.goto("/testing/fixtures/input-forced-colors.html");
  });

  test("keeps a visible keyboard-focus outline on Input and InputGroup in forced colors", async ({
    page,
  }) => {
    const standaloneInput = page.getByRole("textbox", { name: "Standalone input" });
    const groupedInput = page.getByRole("textbox", { name: "Grouped input" });
    const groupedShell = page.locator('[data-slot="input-group"]');

    await page.keyboard.press("Tab");
    await expect(standaloneInput).toBeFocused();

    const standaloneOutline = await getOutline(standaloneInput);
    expect(standaloneOutline.width).toBeGreaterThan(0);
    expect(standaloneOutline.style).not.toBe("none");

    await page.keyboard.press("Tab");
    await expect(groupedInput).toBeFocused();

    const groupedOutline = await getOutline(groupedShell);
    expect(groupedOutline.width).toBeGreaterThan(0);
    expect(groupedOutline.style).not.toBe("none");
  });
});
