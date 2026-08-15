import { expect, type Locator, test } from "@playwright/test";

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

function fontSizeOf(input: Locator): Promise<number> {
  return input.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
}

test.describe("Input shell mobile font size", () => {
  test("keeps every input shell at an iOS-safe font size below the md breakpoint", async ({
    page,
  }) => {
    await page.goto("/testing/fixtures/search-input-mobile.html");
    await page.addStyleTag({ content: TAILWIND_RULES });

    const inputs = [
      page.getByRole("searchbox", { name: "Small search" }),
      page.getByRole("searchbox", { name: "Medium search" }),
      page.getByRole("textbox", { name: "Small input" }),
      page.getByRole("textbox", { name: "Medium input" }),
      page.getByRole("textbox", { name: "Small input group" }),
      page.getByRole("textbox", { name: "Medium input group" }),
    ];

    // Control. Above the breakpoint every shell must compute below 16px, which only happens
    // when the injected rules actually match the class names inputSizeClasses emits. Without
    // it a renamed utility would leave the inputs unstyled at the 16px UA default and the
    // phone-viewport assertion below would pass with the guard gone.
    await page.setViewportSize({ width: 1024, height: 800 });
    for (const input of inputs) {
      await expect(input).toBeVisible();
      expect(await fontSizeOf(input)).toBeLessThan(16);
    }

    await page.setViewportSize({ width: 390, height: 844 });
    for (const input of inputs) {
      expect(await fontSizeOf(input)).toBeGreaterThanOrEqual(16);
    }
  });
});
