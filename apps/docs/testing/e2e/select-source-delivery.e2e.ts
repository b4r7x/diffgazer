import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

// The measured production document is about 632 KB because live example/code
// tabs remain eager. 768 KiB preserves headroom while catching the former
// multi-megabyte component-source serialization regression.
const INITIAL_SELECT_DOCUMENT_BUDGET_BYTES = 768 * 1024;
const SELECT_SOURCE_MARKER = "getVisibleEnabledOptionEntries";
const SELECT_SOURCE_PATH = "/source-data/ui/components/select.source.json";
// Read inside the test, not at module scope: Playwright loads every spec during
// collection, so a missing or partial build must fail as a reported test rather
// than as a bare ENOENT that takes the whole file down.
const SELECT_SOURCE_ARTIFACT_PATH = resolve(
  import.meta.dirname,
  "../../.output/public/source-data/ui/components/select.source.json",
);

test.describe("Select source delivery", () => {
  test("loads source only after the production disclosure opens", async ({ page }) => {
    const pageErrors: string[] = [];
    const sourceRequests: Array<{ url: string; method: string }> = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("request", (request) => {
      const requestUrl = new URL(request.url());
      if (requestUrl.pathname.includes("/source-data/")) {
        sourceRequests.push({ url: request.url(), method: request.method() });
      }
    });

    const selectSourceArtifact = readFileSync(SELECT_SOURCE_ARTIFACT_PATH, "utf8");
    expect(selectSourceArtifact).toContain(SELECT_SOURCE_MARKER);

    const response = await page.goto("/ui/components/select");
    expect(response).not.toBeNull();

    const document = await response?.text();
    expect(document).toBeDefined();
    expect(Buffer.byteLength(document ?? "", "utf8")).toBeLessThanOrEqual(
      INITIAL_SELECT_DOCUMENT_BUDGET_BYTES,
    );
    expect(document).not.toContain(SELECT_SOURCE_MARKER);

    await page.waitForLoadState("networkidle");
    expect(sourceRequests).toEqual([]);

    // Both `defaultOpen` examples have to go: a leftover overlay layer makes the
    // dismiss stack swallow the click that opens the source disclosure below.
    for (const name of ["Framework", "Commands"]) {
      const openExample = page.getByRole("combobox", { name, exact: true });
      await expect(openExample).toHaveAttribute("aria-expanded", "true", { timeout: 15_000 });
      await openExample.press("Enter");
      await expect(openExample).toHaveAttribute("aria-expanded", "false");
    }

    const sourceDisclosure = page.getByRole("button", { name: /View component source/i });
    await sourceDisclosure.scrollIntoViewIfNeeded();
    const mainScrollRegion = page.locator("#main-content");
    await expect
      .poll(async () => {
        const before = {
          box: await sourceDisclosure.boundingBox(),
          scrollTop: await mainScrollRegion.evaluate((element) => element.scrollTop),
        };
        await page.evaluate(
          () =>
            new Promise<void>((resolveFrame) => {
              requestAnimationFrame(() => requestAnimationFrame(() => resolveFrame()));
            }),
        );
        const after = {
          box: await sourceDisclosure.boundingBox(),
          scrollTop: await mainScrollRegion.evaluate((element) => element.scrollTop),
        };

        return after.box !== null && JSON.stringify(after) === JSON.stringify(before);
      })
      .toBe(true);

    await expect(sourceDisclosure).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByText(SELECT_SOURCE_MARKER, { exact: false })).toHaveCount(0);

    const sourceResponsePromise = page.waitForResponse(
      (sourceResponse) => new URL(sourceResponse.url()).pathname === SELECT_SOURCE_PATH,
    );
    await sourceDisclosure.click();
    await expect(sourceDisclosure).toHaveAttribute("aria-expanded", "true");

    const sourceResponse = await sourceResponsePromise;
    const sourceResponseUrl = new URL(sourceResponse.url());
    const pageUrl = new URL(page.url());
    expect(sourceResponse.ok()).toBe(true);
    expect(sourceResponse.request().method()).toBe("GET");
    expect(sourceResponseUrl.origin).toBe(pageUrl.origin);
    expect(sourceResponseUrl.pathname).toBe(SELECT_SOURCE_PATH);
    expect(sourceResponseUrl.search).toBe("");
    expect(sourceResponseUrl.hash).toBe("");
    const sourceResponseHeaders = await sourceResponse.allHeaders();
    expect(sourceResponseHeaders["content-encoding"]).toMatch(/^(?:br|gzip)$/);
    expect(sourceResponseHeaders.vary?.toLowerCase().split(/\s*,\s*/)).toContain("accept-encoding");
    const compressedLength = Number.parseInt(sourceResponseHeaders["content-length"] ?? "", 10);
    expect(compressedLength).toBeGreaterThan(0);
    expect(compressedLength).toBeLessThan(Buffer.byteLength(selectSourceArtifact, "utf8"));
    expect(await sourceResponse.text()).toContain(SELECT_SOURCE_MARKER);
    await expect(page.getByText(SELECT_SOURCE_MARKER, { exact: false }).first()).toBeVisible();
    expect(sourceRequests).toEqual([{ url: sourceResponse.url(), method: "GET" }]);
    expect(pageErrors).toEqual([]);
  });
});
