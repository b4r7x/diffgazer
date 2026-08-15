import { SHUTDOWN_TOKEN_GLOBAL } from "@diffgazer/core/api/protocol";
import { expect, test } from "@playwright/test";

/**
 * Release gate: builds/installs diffgazer, starts the embedded static server, and
 * loads the compiled SPA in a real browser. Normal CI/dev e2e stays on the Vite
 * dev server for speed; set DIFFGAZER_EMBEDDED_E2E=1 in release verification.
 */
test.describe("embedded production smoke", () => {
  test.skip(
    process.env.DIFFGAZER_EMBEDDED_E2E !== "1",
    "Set DIFFGAZER_EMBEDDED_E2E=1 with a built diffgazer package to run the packaged embedded-server browser gate",
  );

  test("loads the compiled SPA through the embedded static server", async ({
    page,
    request,
    baseURL,
  }) => {
    const origin = baseURL ?? "http://127.0.0.1:4173";

    const homeResponse = await page.goto("/", { waitUntil: "domcontentloaded" });
    if (!homeResponse) throw new Error("Navigation to / produced no response");
    expect(homeResponse.ok()).toBe(true);

    const csp = homeResponse.headers()["content-security-policy"];
    expect(csp).toBeTruthy();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toMatch(/script-src[^;]*'nonce-/);

    const shellHtml = await homeResponse.text();
    expect(shellHtml).not.toContain("{{cspNonce}}");
    expect(shellHtml).toContain(`window.${SHUTDOWN_TOKEN_GLOBAL}=`);

    const inlineNonceMatches = [...shellHtml.matchAll(/<script nonce="([A-Za-z0-9+/=]+)">/g)].map(
      (match) => match[1],
    );
    expect(inlineNonceMatches.length).toBeGreaterThanOrEqual(2);
    expect(new Set(inlineNonceMatches).size).toBe(1);

    await expect(page.locator('script[type="module"][src^="/assets/"]')).toHaveCount(1);
    await expect(page.locator('script[src*="/src/main"]')).toHaveCount(0);

    const shutdownToken = await page.evaluate(
      (globalName) => window[globalName as keyof Window & string],
      SHUTDOWN_TOKEN_GLOBAL,
    );
    expect(typeof shutdownToken).toBe("string");
    expect(shutdownToken).toBeTruthy();

    await page.waitForSelector("#root");
    await expect(page.getByText("Server Disconnected")).toHaveCount(0);

    const healthFromPage = await page.evaluate(async () => {
      const response = await fetch("/api/health");
      return {
        ok: response.ok,
        origin: window.location.origin,
        url: response.url,
      };
    });
    expect(healthFromPage.ok).toBe(true);
    expect(healthFromPage.url.startsWith(healthFromPage.origin)).toBe(true);

    const settingsApiResponse = page.waitForResponse(
      (response) =>
        response.url().startsWith(origin) &&
        response.url().includes("/api/") &&
        response.request().method() === "GET",
    );
    await page.goto("/settings", { waitUntil: "domcontentloaded" });
    const apiBackedRouteResponse = await settingsApiResponse;
    expect(apiBackedRouteResponse.ok()).toBe(true);
    await expect(page).toHaveURL(/\/settings/);
    await expect(page.getByText("Server Disconnected")).toHaveCount(0);

    const healthResponse = await request.get(`${origin}/api/health`);
    expect(healthResponse.ok()).toBe(true);
  });
});
