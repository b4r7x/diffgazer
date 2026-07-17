import { expect, test } from "@playwright/test";

const destinations = [
  { name: "Button", href: "/ui/components/button", heading: "Button" },
  { name: "Checkbox", href: "/ui/components/checkbox", heading: "Checkbox" },
  { name: "Getting Started", href: "/ui/getting-started", heading: "Getting Started" },
] as const;

test.describe("Pager example links", () => {
  for (const destination of destinations) {
    test(`navigates to ${destination.href}`, async ({ page }) => {
      await page.goto("/ui/components/pager");

      const pager = page
        .getByRole("navigation", { name: "Page navigation" })
        .filter({ has: page.getByRole("link", { name: destination.name, exact: true }) });
      const link = pager.getByRole("link", { name: destination.name, exact: true });
      await expect(link).toHaveAttribute("href", destination.href);

      await link.click();

      await expect(page).toHaveURL(new RegExp(`${destination.href}$`));
      await expect(
        page.getByRole("heading", { level: 1, name: destination.heading }),
      ).toBeVisible();
      await expect(page.getByRole("heading", { name: /page not found/i })).toHaveCount(0);
    });
  }
});
