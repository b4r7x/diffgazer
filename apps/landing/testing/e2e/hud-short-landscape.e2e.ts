import { expect, test } from "@playwright/test";

test.describe("HUD short-landscape viewport", () => {
  test.use({ viewport: { width: 720, height: 400 } });

  test("findings scene scroll band activates reveal, label, and light theme", async ({ page }) => {
    await page.goto("/");

    const findings = page.locator("#s4");
    const html = page.locator("html");

    await expect(findings).toBeAttached();

    // Every scene is at least one viewport tall, so aligning #s4 to the top puts
    // it — and only it — above the middle line the HUD resolves the active scene from.
    await findings.evaluate((scene) => scene.scrollIntoView({ block: "start" }));

    await expect(findings).toHaveClass(/\bin\b/);
    await expect(page.locator("#osd-label")).toHaveText("04 / FINDINGS");
    await expect(html).toHaveAttribute("data-theme", "light");
    await expect(html).toHaveAttribute("data-scene-theme", "light");
  });
});
