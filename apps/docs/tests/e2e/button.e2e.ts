import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("Button", () => {
  test("default examples render with no a11y violations", async ({ page }) => {
    await page.goto("/ui/components/button");
    const heading = page.getByRole("heading", { level: 1, name: /button/i });
    await expect(heading).toBeVisible();

    const firstButton = page.getByRole("button", { name: /submit/i }).first();
    await expect(firstButton).toBeVisible();
    await expect(firstButton).toHaveScreenshot("button-primary.png");

    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(results.violations).toEqual([]);
  });

  for (const viewport of [
    { width: 640, label: "200%" },
    { width: 320, label: "400%" },
  ]) {
    test(`keeps short and localized labels operable at ${viewport.label} reflow`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: 900 });
      await page.goto("/ui/components/button");
      await page.addStyleTag({
        content: `
          [data-slot="button"] {
            line-height: 1.5 !important;
            letter-spacing: 0.12em !important;
            word-spacing: 0.16em !important;
          }
        `,
      });

      const submitButton = page.getByRole("button", { name: /submit/i }).first();
      const short = page.getByRole("button", { name: /cancel/i }).first();
      await submitButton.evaluate((button) => {
        button.dataset.e2eLocalized = "true";
        button.textContent = "Zapisz ustawienia i kontynuuj przegląd zmian w repozytorium";
      });
      const localized = page.locator('[data-e2e-localized="true"]');
      await expect(localized).toHaveAccessibleName(
        "Zapisz ustawienia i kontynuuj przegląd zmian w repozytorium",
      );
      await localized.scrollIntoViewIfNeeded();

      const readGeometry = (button: HTMLElement) => {
        const rect = button.getBoundingClientRect();
        const hit = document.elementFromPoint(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
        );
        return {
          fits: rect.left >= -0.5 && rect.right <= window.innerWidth + 0.5,
          centerHits: hit === button || button.contains(hit),
        };
      };
      const [localizedGeometry, shortGeometry, documentGeometry] = await Promise.all([
        localized.evaluate(readGeometry),
        short.evaluate(readGeometry),
        page.evaluate(() => ({
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: document.documentElement.clientWidth,
        })),
      ]);

      expect(documentGeometry.documentWidth).toBeLessThanOrEqual(documentGeometry.viewportWidth);
      expect(localizedGeometry).toEqual({ fits: true, centerHits: true });
      expect(shortGeometry).toEqual({ fits: true, centerHits: true });

      await short.click();
      await localized.click();
    });
  }
});
