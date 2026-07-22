import { type APIResponse, expect, test } from "@playwright/test";

const PAGES = ["/", "/app/architecture", "/ui/theme"];
const MISSING_STATIC_RESOURCES = [
  "/assets/__missing__.js",
  "/r/__missing__.json",
  "/schema/__missing__.json",
] as const;

const EXPECTED_BASE_SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=()",
  "Cache-Control": "public, max-age=0, must-revalidate",
} as const;

function expectBaseSecurityHeaders(response: APIResponse): void {
  const headers = response.headers();
  for (const [name, value] of Object.entries(EXPECTED_BASE_SECURITY_HEADERS)) {
    expect(headers[name.toLowerCase()]).toBe(value);
  }
}

function expectNonceCsp(response: APIResponse): void {
  const csp = response.headers()["content-security-policy"] ?? "";
  const scriptSrc = csp.split(";").find((directive) => directive.trim().startsWith("script-src"));
  expect(scriptSrc).toBeDefined();
  expect(scriptSrc).not.toContain("'unsafe-inline'");
  expect(scriptSrc).toMatch(/'nonce-[^']+'/);
}

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

  test("serves known static resources and ordinary HTML navigation", async ({ request }) => {
    const htmlResponse = await request.get("/");
    expect(htmlResponse.status()).toBe(200);
    const html = await htmlResponse.text();
    const assetPath = html.match(/(?:src|href)="([^"]*\/assets\/[^"]+)"/)?.[1];
    if (!assetPath) throw new Error("Docs HTML did not reference a built asset");

    const assetResponse = await request.get(assetPath, {
      headers: { "Accept-Encoding": "br" },
    });
    expect(assetResponse.status()).toBe(200);
    expect(assetResponse.headers()["cache-control"]).toBe("public, max-age=31536000, immutable");
    expect(assetResponse.headers()["content-encoding"]).toBe("br");

    const registryResponse = await request.get("/r/ui/registry.json", {
      headers: { "Accept-Encoding": "br" },
    });
    expect(registryResponse.status()).toBe(200);
    expect(registryResponse.headers()["cache-control"]).toBe(
      EXPECTED_BASE_SECURITY_HEADERS["Cache-Control"],
    );
    expect(registryResponse.headers()["content-encoding"]).toBe("br");

    expect((await request.get("/schema/diffgazer.json")).status()).toBe(200);

    const navigation = await request.get("/app/architecture");
    expect(navigation.status()).toBe(200);
    expect(await navigation.text()).toContain("Architecture");
  });

  for (const path of MISSING_STATIC_RESOURCES) {
    for (const method of ["GET", "HEAD"] as const) {
      test(`${method} ${path} returns an exact static 404`, async ({ request }) => {
        const response = await request.fetch(path, { method });
        expect(response.status()).toBe(404);
        expectBaseSecurityHeaders(response);
        expectNonceCsp(response);
      });
    }

    test(`POST ${path} returns 405 with the static method contract`, async ({ request }) => {
      const response = await request.post(path);
      expect(response.status()).toBe(405);
      expect(response.headers().allow).toBe("GET, HEAD");
      expectBaseSecurityHeaders(response);
      expectNonceCsp(response);
    });
  }
});
