import { expect, test } from "@playwright/test";

test.describe("Sidebar owner-window example", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 720 });
    await page.goto("/testing/fixtures/sidebar-owner-window.html");
  });

  test("opens a themed edge drawer inside the iframe with documented geometry", async ({
    page,
  }) => {
    const frame = page.frameLocator('iframe[title="Sidebar owner window"]');

    await frame.getByRole("button", { name: "Open navigation" }).click();

    const dialog = frame.getByRole("dialog", { name: "Frame navigation" });
    await expect(dialog).toBeVisible();

    const geometry = await dialog.evaluate((element) => {
      const styles = getComputedStyle(element);
      return {
        maxWidth: styles.maxWidth,
        marginLeft: styles.marginLeft,
        marginRight: styles.marginRight,
        borderTopLeftRadius: styles.borderTopLeftRadius,
        borderTopRightRadius: styles.borderTopRightRadius,
        borderRightWidth: styles.borderRightWidth,
        backgroundColor: styles.backgroundColor,
      };
    });

    // 420px iframe viewport → min(86vw, 320px) = 320px edge drawer.
    expect(geometry.maxWidth).toBe("320px");
    expect(geometry.marginLeft).toBe("0px");
    expect(geometry.marginRight).toBe("0px");
    expect(geometry.borderTopLeftRadius).toBe("0px");
    expect(geometry.borderTopRightRadius).toBe("0px");
    expect(geometry.borderRightWidth).not.toBe("0px");
    expect(geometry.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
  });
});
