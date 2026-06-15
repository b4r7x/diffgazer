import { expect, test } from "@playwright/test";

const PAGES = ["/", "/app/architecture", "/ui/theme"];

function isCspViolation(text: string): boolean {
  return /content security policy|refused to (execute|load|apply)/i.test(text);
}

test.describe("Docs security headers", () => {
  for (const path of PAGES) {
    test(`${path} hydrates with no CSP violations`, async ({ page }) => {
      const cspViolations: string[] = [];
      page.on("console", (message) => {
        if (isCspViolation(message.text())) cspViolations.push(message.text());
      });
      page.on("pageerror", (error) => {
        if (isCspViolation(error.message)) cspViolations.push(error.message);
      });

      const response = await page.goto(path);
      const csp = response?.headers()["content-security-policy"] ?? "";
      const scriptSrc = csp
        .split(";")
        .find((directive) => directive.trim().startsWith("script-src"));
      expect(scriptSrc).toBeDefined();
      expect(scriptSrc).not.toContain("'unsafe-inline'");
      expect(scriptSrc).toMatch(/'nonce-[^']+'/);
      // Fonts are now self-hosted; no Google allowances remain in the CSP.
      expect(csp).not.toContain("fonts.googleapis");
      expect(csp).not.toContain("fonts.gstatic");

      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
      expect(cspViolations).toEqual([]);
    });
  }

  test("the theme toggle stays interactive under the nonce CSP", async ({ page }) => {
    const cspViolations: string[] = [];
    page.on("console", (message) => {
      if (isCspViolation(message.text())) cspViolations.push(message.text());
    });

    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(async () => {
      await page.getByRole("button", { name: /switch to light theme/i }).click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    }).toPass();

    expect(cspViolations).toEqual([]);
  });

  test("no Google Fonts references ship in the prerendered head", async ({ page }) => {
    const response = await page.goto("/");
    const html = (await response?.text()) ?? "";
    expect(html).not.toContain("fonts.googleapis");
    expect(html).not.toContain("fonts.gstatic");
  });
});
