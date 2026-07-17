import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page, test } from "@playwright/test";

// The measured production document is about 632 KB because live example/code
// tabs remain eager. 768 KiB preserves headroom while catching the former
// multi-megabyte component-source serialization regression.
const INITIAL_SELECT_DOCUMENT_BUDGET_BYTES = 768 * 1024;
const SELECT_SOURCE_MARKER = "getVisibleEnabledOptionEntries";
const SELECT_SOURCE_PATH = "/source-data/ui/components/select.source.json";
const BUILD_OUTPUT_ROOT = resolve(import.meta.dirname, "../../.output");
const SOURCE_CHUNK_DIRECTORIES = [
  join(BUILD_OUTPUT_ROOT, "public/assets"),
  join(BUILD_OUTPUT_ROOT, "server"),
];
const SOURCE_ARCHIVE_CHUNK_PATTERN = /\.source-[^/]+\.m?js$/;
const SELECT_SOURCE_ARTIFACT = readFileSync(
  join(BUILD_OUTPUT_ROOT, "public/source-data/ui/components/select.source.json"),
  "utf8",
);

function findSourceArchiveChunks(directory: string): string[] {
  const matches: string[] = [];
  const visit = (currentDirectory: string) => {
    for (const entry of readdirSync(currentDirectory, { withFileTypes: true })) {
      const entryPath = join(currentDirectory, entry.name);
      if (entry.isDirectory()) {
        visit(entryPath);
      } else if (SOURCE_ARCHIVE_CHUNK_PATTERN.test(entry.name)) {
        matches.push(relative(BUILD_OUTPUT_ROOT, entryPath));
      }
    }
  };

  visit(directory);
  return matches;
}

async function getOpenListbox(page: Page, trigger: Locator): Promise<Locator> {
  const listboxId = await trigger.getAttribute("aria-controls");
  if (!listboxId) throw new Error("Select trigger did not expose aria-controls");

  const listbox = page.locator(`[id="${listboxId}"]`);
  await expect(listbox).toBeVisible();
  await expect(listbox).toHaveAttribute("data-positioned", "");
  return listbox;
}

async function expectDocumentFocus(locator: Locator): Promise<void> {
  await expect
    .poll(() => locator.evaluate((element) => element.ownerDocument.activeElement === element))
    .toBe(true);
}

async function closeDefaultOpenCard(page: Page): Promise<void> {
  const openCardExample = page.getByRole("combobox", { name: "Framework" });
  await expect(openCardExample).toHaveAttribute("aria-expanded", "true", { timeout: 15_000 });
  await openCardExample.press("Enter");
  await expect(openCardExample).toHaveAttribute("aria-expanded", "false");
}

function getDefaultBranchTrigger(page: Page): Locator {
  return page
    .getByRole("main")
    .getByRole("tabpanel")
    .first()
    .getByRole("combobox", { name: "Branch" });
}

async function selectSecondBranch(
  page: Page,
  trigger: Locator,
  open: () => Promise<void>,
): Promise<void> {
  await open();
  const listbox = await getOpenListbox(page, trigger);
  await expectDocumentFocus(listbox);
  await page.keyboard.press("ArrowDown");
  await expect(listbox.getByRole("option", { name: "develop" })).toHaveAttribute(
    "data-highlighted",
    "",
  );
  await page.keyboard.press("Enter");
  await expect(trigger).toContainText("develop");
}

test.describe("Select", () => {
  test("does not emit source archives as JavaScript chunks", () => {
    const sourceArchiveChunks = SOURCE_CHUNK_DIRECTORIES.flatMap(findSourceArchiveChunks);
    expect(sourceArchiveChunks).toEqual([]);
  });

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

    expect(SELECT_SOURCE_ARTIFACT).toContain(SELECT_SOURCE_MARKER);

    const response = await page.goto("/ui/components/select");
    expect(response).not.toBeNull();

    const document = await response?.text();
    expect(document).toBeDefined();
    expect(Buffer.byteLength(document ?? "", "utf8")).toBeLessThanOrEqual(
      INITIAL_SELECT_DOCUMENT_BUDGET_BYTES,
    );
    expect(document).not.toContain(SELECT_SOURCE_MARKER);

    await page.waitForLoadState("networkidle");
    const initialResources = await page.evaluate(() =>
      performance.getEntriesByType("resource").map((entry) => entry.name),
    );
    expect(initialResources.some((url) => new URL(url).pathname === SELECT_SOURCE_PATH)).toBe(
      false,
    );
    expect(sourceRequests).toEqual([]);

    // The card variant example intentionally starts open. Close it through its
    // public keyboard interaction so its outside-click guard cannot consume the
    // source disclosure's pointer click as click-through.
    await closeDefaultOpenCard(page);

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
    expect(compressedLength).toBeLessThan(Buffer.byteLength(SELECT_SOURCE_ARTIFACT, "utf8"));
    expect(await sourceResponse.text()).toContain(SELECT_SOURCE_MARKER);
    await expect(page.getByText(SELECT_SOURCE_MARKER, { exact: false }).first()).toBeVisible();
    expect(sourceRequests).toEqual([{ url: sourceResponse.url(), method: "GET" }]);
    expect(pageErrors).toEqual([]);
  });

  test("focuses the listbox after a pointer open and selects with ArrowDown and Enter", async ({
    page,
  }) => {
    await page.goto("/ui/components/select");
    await closeDefaultOpenCard(page);
    const trigger = getDefaultBranchTrigger(page);

    await selectSecondBranch(page, trigger, () => trigger.click());
  });

  test("focuses the listbox after a keyboard open and selects with ArrowDown and Enter", async ({
    page,
  }) => {
    await page.goto("/ui/components/select");
    await closeDefaultOpenCard(page);
    const trigger = getDefaultBranchTrigger(page);

    await selectSecondBranch(page, trigger, async () => {
      await trigger.focus();
      await page.keyboard.press("Enter");
    });
  });

  test("focuses the listbox after a programmatic open and selects with ArrowDown and Enter", async ({
    page,
  }) => {
    await page.goto("/ui/components/select");
    await closeDefaultOpenCard(page);
    const trigger = getDefaultBranchTrigger(page);
    const triggerId = await trigger.getAttribute("id");
    if (!triggerId) throw new Error("Select trigger did not expose an id");

    await selectSecondBranch(page, trigger, () =>
      page.evaluate((id) => {
        const activeElement = document.activeElement;
        if (activeElement instanceof HTMLElement) activeElement.blur();
        if (document.activeElement !== document.body) {
          throw new Error("Programmatic Select open requires unowned document focus");
        }
        const element = document.getElementById(id);
        if (!(element instanceof HTMLElement)) throw new Error("Select trigger is not an element");
        element.click();
      }, triggerId),
    );
  });

  test("focuses the search input after a searchable open and selects with ArrowDown and Enter", async ({
    page,
  }) => {
    await page.goto("/ui/components/select");
    await closeDefaultOpenCard(page);
    const searchablePreview = page
      .getByRole("heading", { level: 4, name: "Searchable (bottom)" })
      .locator("..");
    const trigger = searchablePreview.getByRole("button", { name: "Command" });

    await trigger.click();
    const searchInput = page
      .getByRole("listbox", { name: "Command" })
      .locator("..")
      .getByRole("combobox", { name: "Search options" });
    await expect(searchInput).toBeVisible();
    await expectDocumentFocus(searchInput);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(trigger).toContainText("git commit");
  });

  test("opens listbox via keyboard and reports no a11y violations", async ({ page }) => {
    await page.goto("/ui/components/select");
    await expect(page.getByRole("heading", { level: 1, name: /select/i })).toBeVisible();
    await closeDefaultOpenCard(page);

    const combo = page.getByRole("main").getByRole("combobox").first();
    await combo.focus();
    await page.keyboard.press("Enter");

    const listboxId = await combo.getAttribute("aria-controls");
    expect(listboxId).toBeTruthy();
    const listbox = page.locator(`[id="${listboxId}"]`);
    await expect(listbox).toBeVisible();
    await expect(listbox).toHaveAttribute("data-positioned", "");
    await expect(listbox).toHaveAttribute("data-side", "bottom");
    await expect(listbox).toHaveAttribute("data-align", "start");
    await expect
      .poll(async () => {
        const before = await listbox.boundingBox();
        await page.evaluate(
          () =>
            new Promise<void>((resolveFrame) => {
              requestAnimationFrame(() => requestAnimationFrame(() => resolveFrame()));
            }),
        );
        const after = await listbox.boundingBox();

        return (
          before !== null && after !== null && JSON.stringify(after) === JSON.stringify(before)
        );
      })
      .toBe(true);
    const listboxSize = await listbox.evaluate((element) => {
      const { width, height } = element.getBoundingClientRect();
      return { width, height };
    });
    expect(listboxSize).toEqual({ width: 256, height: 162 });

    // Pin only this panel inside the viewport so fractional anchor coordinates cannot alter its clip.
    const snapshotInset = 100;
    const snapshotSelector = await listbox.evaluate((element) => `#${CSS.escape(element.id)}`);
    const snapshotStyle = await page.addStyleTag({
      content: `${snapshotSelector} { top: ${snapshotInset}px !important; left: ${snapshotInset}px !important; }`,
    });
    const snapshotRect = await listbox.evaluate((element) => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height };
    });
    expect(snapshotRect).toEqual({
      x: snapshotInset,
      y: snapshotInset,
      width: 256,
      height: 162,
    });
    await expect(listbox).toHaveScreenshot("select-listbox-open.png");
    await snapshotStyle.evaluate((element) => element.parentNode?.removeChild(element));

    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(results.violations).toEqual([]);

    await page.keyboard.press("Escape");
    await expect(listbox).toBeHidden();
  });
});
