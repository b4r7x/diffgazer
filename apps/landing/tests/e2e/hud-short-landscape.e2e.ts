import { expect, test } from "@playwright/test";

test.describe("HUD short-landscape viewport", () => {
  test.use({ viewport: { width: 720, height: 400 } });

  test("findings scene scroll band activates reveal, label, and light theme", async ({ page }) => {
    await page.goto("/");

    const findings = page.locator("#s4");

    await expect(findings).toBeAttached();

    await expect(async () => {
      const maxScroll = await page.evaluate(
        () => document.documentElement.scrollHeight - window.innerHeight,
      );

      for (let scrollY = 0; scrollY <= maxScroll; scrollY += 32) {
        await page.evaluate((y) => window.scrollTo(0, y), scrollY);

        const activated = await page.evaluate(() => {
          const scene = document.querySelector("#s4");
          const osd = document.querySelector("#osd-label");
          const html = document.documentElement;
          return (
            scene?.classList.contains("in") === true &&
            osd?.textContent === "04 / FINDINGS" &&
            html.dataset.theme === "light" &&
            html.dataset.sceneTheme === "light"
          );
        });

        if (activated) return;
      }

      throw new Error("findings scene never entered the HUD scroll band");
    }).toPass();
  });
});
