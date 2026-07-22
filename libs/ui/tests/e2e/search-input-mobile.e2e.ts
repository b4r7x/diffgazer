import { expect, test } from "@playwright/test";

// libs/ui ships Tailwind utility class names for consuming apps to compile; this workspace's
// own e2e fixtures do not run the Tailwind compiler. This reproduces the exact rules a
// consuming app's build generates for the sm/md text-size utilities, the `max-md:text-base`
// override, and the Preflight reset that lets a native <input> inherit font-size from its
// wrapper, so the assertions below exercise real browser cascade/inheritance, not a mock.
const TAILWIND_RULES = `
  .text-xs { font-size: 0.75rem; }
  .text-sm { font-size: 0.875rem; }
  input { font: inherit; }
  @media not all and (min-width: 48rem) {
    .max-md\\:text-base { font-size: 1rem; }
  }
`;

test.describe("SearchInput mobile font size", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("keeps sm and md search inputs at an iOS-safe font size below the md breakpoint", async ({
    page,
  }) => {
    await page.goto("/tests/fixtures/search-input-mobile.html");
    await page.addStyleTag({ content: TAILWIND_RULES });

    const small = page.getByRole("searchbox", { name: "Small search" });
    const medium = page.getByRole("searchbox", { name: "Medium search" });

    for (const input of [small, medium]) {
      await expect(input).toBeVisible();
      const fontSize = await input.evaluate((element) =>
        Number.parseFloat(getComputedStyle(element).fontSize),
      );
      expect(fontSize).toBeGreaterThanOrEqual(16);
    }
  });
});
