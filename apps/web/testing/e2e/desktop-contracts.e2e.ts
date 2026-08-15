import { ConfigurationModelsResponseSchema } from "@diffgazer/core/schemas/config";
import { SEVERITY_LABELS } from "@diffgazer/core/schemas/presentation";
import { canonicalReviewFixture } from "@diffgazer/core/testing/review-facts";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { mockProtectedProviderApi } from "./provider-fixture";

/**
 * The layout regressions this file guards were all desktop-shaped: centred panels
 * drifting into a corner, settings widths diverging, banner headers stacking into
 * two rows, and touch-sized chips landing on a mouse. The other e2e suites measure
 * the 390px shape almost exclusively, so the desktop shape could regress unwatched.
 * These contracts run at the fine-pointer size the product is actually used at.
 */
const DESKTOP_VIEWPORT = { width: 1280, height: 800 };

test.use({ viewport: DESKTOP_VIEWPORT });
test.skip(
  ({ isMobile }) => isMobile === true,
  "desktop-width layout contracts are a fine-pointer contract",
);

async function mockAppApi(page: Page) {
  await mockProtectedProviderApi(page);
  // Diagnostics reads the workspace context snapshot. 404 is the "never generated"
  // answer and is not retried, so the panel settles into one geometry to measure.
  await page.route("**/api/review/context", (route) =>
    route.fulfill({ status: 404, json: { error: "context not generated" } }),
  );
}

/**
 * The dialog renders model rows only when the response parses as the discovery
 * contract *and* carries the identity of the configuration it asked about, so
 * the fixture is built through the schema: a contract change fails here instead
 * of dropping the test into the discovery-error state it would then measure.
 */
const MODEL_DISCOVERY_RESPONSE = ConfigurationModelsResponseSchema.parse({
  status: "passed",
  configurationId: "gemini-primary",
  productId: "gemini",
  transportFamily: "hosted-api",
  models: [
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", description: "Fast", tier: "free" },
    { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", description: "Deep", tier: "paid" },
  ],
  checkedAt: "2026-01-01T00:00:00.000Z",
  source: "snapshot",
  cached: false,
});

async function mockModelDiscovery(page: Page) {
  await page.route("**/api/config/providers/*/models", (route) =>
    route.fulfill({ json: MODEL_DISCOVERY_RESPONSE }),
  );
}

async function boxOf(locator: Locator, name: string) {
  const box = await locator.boundingBox();
  if (!box) throw new Error(`${name} has no bounding box`);
  return box;
}

function overlapsVertically(a: { y: number; height: number }, b: { y: number; height: number }) {
  return Math.max(a.y, b.y) < Math.min(a.y + a.height, b.y + b.height);
}

/** Rendered heights of every element a locator resolves to, in DOM order. */
async function measureHeights(locator: Locator): Promise<number[]> {
  return locator.evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
}

interface ScrollViewportGeometry {
  centerXDelta: number;
  centerYDelta: number;
  panelWidth: number;
}

/**
 * Where a panel sits inside the scrollport that owns it. The scrollport is found
 * by walking up from the panel rather than by class name, because which element
 * scrolls differs per screen (a plain overflow wrapper on the hub, a ScrollArea
 * on help) and the contract is about the box the user sees, not the markup.
 */
async function measureInScrollViewport(panel: Locator): Promise<ScrollViewportGeometry> {
  return panel.evaluate((element) => {
    let scroller = element.parentElement;
    while (scroller) {
      const { overflowY } = getComputedStyle(scroller);
      if (overflowY === "auto" || overflowY === "scroll") break;
      scroller = scroller.parentElement;
    }
    if (!scroller) throw new Error("the panel has no scrolling ancestor");

    const scrollerRect = scroller.getBoundingClientRect();
    // clientLeft/clientTop plus clientWidth/clientHeight is the scrollport itself:
    // borders and any scrollbar gutter drop out, so the centre compared against is
    // the box the panel is actually seen inside.
    const viewLeft = scrollerRect.left + scroller.clientLeft;
    const viewTop = scrollerRect.top + scroller.clientTop;
    const panelRect = element.getBoundingClientRect();

    return {
      centerXDelta: panelRect.left + panelRect.width / 2 - (viewLeft + scroller.clientWidth / 2),
      centerYDelta: panelRect.top + panelRect.height / 2 - (viewTop + scroller.clientHeight / 2),
      panelWidth: panelRect.width,
    };
  });
}

const SINGLE_PANEL_SCREENS = [
  { path: "/settings", panel: "Settings Hub", contentWidth: 672 },
  { path: "/settings/diagnostics", panel: "System Diagnostics", contentWidth: 672 },
  // Help is not a settings form and keeps its own wider large-screen tier, so the
  // shared 672px width does not apply to it — only the centring half does.
  { path: "/help", panel: "Help", contentWidth: null },
] as const;

test("single-panel screens centre on both axes inside their scroll viewport", async ({ page }) => {
  await mockAppApi(page);

  for (const screen of SINGLE_PANEL_SCREENS) {
    await page.goto(screen.path);
    // Exact: the help screen nests the measured "Help" panel inside a labelled
    // "Help content" scroll region, and role-name matching is substring by default.
    const panel = page.getByRole("region", { name: screen.panel, exact: true });
    await expect(panel).toBeVisible();

    const geometry = await measureInScrollViewport(panel);
    expect(Math.abs(geometry.centerXDelta), `${screen.path} horizontal centre`).toBeLessThanOrEqual(
      1,
    );
    // Both axes: the auto margins that centre these panels collapse the moment
    // the content outgrows the scrollport, so a vertical centre off by more than
    // a pixel is either a lost centring rule or a density regression.
    expect(Math.abs(geometry.centerYDelta), `${screen.path} vertical centre`).toBeLessThanOrEqual(
      1,
    );
    if (screen.contentWidth !== null) {
      expect(geometry.panelWidth, `${screen.path} content width`).toBe(screen.contentWidth);
    }
  }
});

test("the theme screen renders two equal-height columns", async ({ page }) => {
  await mockAppApi(page);
  await page.goto("/settings/theme");

  const selector = page.getByRole("region", { name: "Theme Settings" });
  const preview = page.getByRole("region", { name: "Live Preview" });
  await expect(selector).toBeVisible();
  await expect(preview).toBeVisible();

  const selectorBox = await boxOf(selector, "theme selector");
  const previewBox = await boxOf(preview, "theme preview");

  expect(previewBox.x).toBeGreaterThanOrEqual(selectorBox.x + selectorBox.width);
  expect(previewBox.y).toBeCloseTo(selectorBox.y, 0);
  // Stretched columns: the preview pane ends where the selector does, so the
  // selector's action row can sit on a shared bottom rule.
  expect(Math.abs(previewBox.height - selectorBox.height)).toBeLessThanOrEqual(1);
});

/** The rule under the wordmark art, rendered as its own line at every tier. */
const ORNAMENT = "─ ✦ ─ ✧ ─";

const WORDMARK_TIERS = [
  // Banner tier: the settings hub opens a section, so it carries the full block.
  // The whole settings section shares this tier — the wordmark must not resize
  // moving between the hub and its children — so the dense sample lives on a
  // route outside that flow.
  { path: "/settings", maxHeight: 140 },
  // Dense tier: a work screen keeps the header compact.
  { path: "/history", maxHeight: 96 },
] as const;

test("headers compose back, wordmark, and status on one row at every tier", async ({ page }) => {
  await mockAppApi(page);

  for (const tier of WORDMARK_TIERS) {
    await page.goto(tier.path);

    const header = page.getByRole("banner");
    const back = header.getByRole("button", { name: /back/i });
    const wordmark = header.getByRole("img", { name: "diffgazer" });
    const status = header.getByRole("status");
    const ornament = header.getByText(ORNAMENT);
    await expect(wordmark).toBeVisible();
    await expect(back).toBeVisible();
    await expect(status).toBeVisible();
    await expect(ornament).toBeVisible();

    const wordmarkBox = await boxOf(wordmark, `${tier.path} wordmark`);
    const backBox = await boxOf(back, `${tier.path} back control`);
    const statusBox = await boxOf(status, `${tier.path} status chip`);
    const ornamentBox = await boxOf(ornament, `${tier.path} ornament`);

    // One row: nothing stacks below the wordmark, so both flanking controls share
    // the band the wordmark occupies.
    expect(overlapsVertically(backBox, wordmarkBox), `${tier.path} back on the wordmark row`).toBe(
      true,
    );
    expect(
      overlapsVertically(statusBox, wordmarkBox),
      `${tier.path} status on the wordmark row`,
    ).toBe(true);
    expect(backBox.x + backBox.width, `${tier.path} back sits left`).toBeLessThanOrEqual(
      wordmarkBox.x,
    );
    expect(statusBox.x, `${tier.path} status sits right`).toBeGreaterThanOrEqual(
      wordmarkBox.x + wordmarkBox.width,
    );

    // The ornament hangs under the art on its own line. It used to be an
    // absolutely positioned overlay, which put it on top of the last figlet row.
    expect(ornamentBox.y, `${tier.path} ornament under the wordmark`).toBeGreaterThanOrEqual(
      wordmarkBox.y + wordmarkBox.height,
    );

    // The block is one canonical rendering scaled per tier, so each tier is pinned
    // by its own height budget.
    expect(wordmarkBox.height, `${tier.path} wordmark height`).toBeLessThanOrEqual(tier.maxHeight);
  }
});

/**
 * The gutter the issue row's title cell keeps between itself and the severity
 * tag beside it. The row grid has no column gap, so without it a title that
 * fills its track rendered "…on every keypressMED" as one word.
 */
const TITLE_TAG_GUTTER = 12;

test("issue rows keep their title clear of the severity tag", async ({ page }) => {
  await page.goto("/testing/fixtures/app-fixture.html?view=results");

  const issues = canonicalReviewFixture.result.issues;
  const rows = page.getByRole("listbox", { name: "Issues" }).getByRole("option");
  await expect(rows).toHaveCount(issues.length);

  const gutters: number[] = [];
  for (const [index, issue] of issues.entries()) {
    const row = rows.nth(index);
    const titleBox = await boxOf(row.getByText(issue.title, { exact: true }), `${issue.id} title`);
    const tagBox = await boxOf(
      row.getByText(SEVERITY_LABELS[issue.severity], { exact: true }),
      `${issue.id} severity tag`,
    );
    gutters.push(Math.round(tagBox.x - (titleBox.x + titleBox.width)));
  }

  for (const [index, gutter] of gutters.entries()) {
    expect(gutter, `${issues[index]?.id} gutter`).toBeGreaterThanOrEqual(TITLE_TAG_GUTTER);
  }
  // Every canonical title is long enough to fill its track, so the narrowest
  // gutter is the padding itself — the measurement is not passing on slack.
  expect(Math.min(...gutters), "narrowest gutter").toBe(TITLE_TAG_GUTTER);
});

test("the summary category panel takes the whole row only when there is nothing to tabulate", async ({
  page,
}) => {
  const breakdown = page.getByRole("region", { name: "Severity breakdown" });
  const categories = page.getByRole("region", { name: "Issues by category" });

  await page.goto("/testing/fixtures/app-fixture.html?view=summary");
  await expect(categories).toBeVisible();
  const pairedBreakdown = await boxOf(breakdown, "severity breakdown");
  const pairedCategories = await boxOf(categories, "category panel");

  // A run with categories keeps the two panels paired on one row, in equal columns.
  expect(pairedCategories.y, "paired category panel row").toBeCloseTo(pairedBreakdown.y, 0);
  expect(pairedCategories.x, "paired category panel column").toBeGreaterThanOrEqual(
    pairedBreakdown.x + pairedBreakdown.width,
  );
  expect(Math.abs(pairedCategories.width - pairedBreakdown.width)).toBeLessThanOrEqual(1);

  await page.goto("/testing/fixtures/app-fixture.html?view=summary&issues=none");
  await expect(categories).toBeVisible();
  const cleanBreakdown = await boxOf(breakdown, "clean severity breakdown");
  const cleanCategories = await boxOf(categories, "clean category panel");

  // A clean run has nothing to tabulate, so the panel leaves the pairing and
  // says so across the whole row: stretched to a half-width column it read as a
  // box with a lost sentence in it.
  expect(cleanCategories.y, "clean category panel row").toBeGreaterThanOrEqual(
    cleanBreakdown.y + cleanBreakdown.height,
  );
  expect(cleanCategories.x, "clean category panel start").toBeCloseTo(cleanBreakdown.x, 0);
  expect(cleanCategories.width, "clean category panel span").toBeGreaterThanOrEqual(
    cleanBreakdown.width * 2,
  );
});

test("severity filter chips keep their compact fine-pointer height", async ({ page }) => {
  await page.goto("/testing/fixtures/app-fixture.html?view=results");

  const chips = page.getByRole("group", { name: "Severity filter" }).getByRole("button");
  await expect(chips.first()).toBeVisible();

  // The 44px touch target belongs to coarse pointers only; on a mouse the filter
  // row sits above a dense list and stays chip-sized.
  const heights = await measureHeights(chips);
  expect(heights.length).toBeGreaterThan(0);
  for (const height of heights) {
    expect(height).toBeLessThanOrEqual(24);
  }
});

interface PageAnchors {
  body: { x: number; y: number; width: number; height: number };
  shell: { x: number; y: number; width: number; height: number };
  bodyTransform: string;
  scrollY: number;
}

async function readPageAnchors(page: Page): Promise<PageAnchors> {
  return page.evaluate(() => {
    const shell = document.querySelector('[data-layout="app-shell"]');
    if (!shell) throw new Error("app shell missing");
    const round = ({ x, y, width, height }: DOMRect) => ({
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(width),
      height: Math.round(height),
    });
    return {
      body: round(document.body.getBoundingClientRect()),
      shell: round(shell.getBoundingClientRect()),
      bodyTransform: getComputedStyle(document.body).transform,
      scrollY: window.scrollY,
    };
  });
}

test("opening a dialog moves nothing on the page and keeps its filter chips compact", async ({
  page,
}) => {
  await mockAppApi(page);
  await mockModelDiscovery(page);
  await page.goto("/settings/providers");

  await page.getByRole("option", { name: /Google Gemini/ }).click();
  const details = page.locator('[data-layout-pane="provider-details"]');
  await expect(details).toBeVisible();

  const before = await readPageAnchors(page);
  await page.getByRole("button", { name: /Select model/i }).click();
  const dialog = page.getByRole("dialog", { name: "Select Model" });
  await expect(dialog).toBeVisible();
  // Discovery has to have landed before anything is measured: the tier chips
  // render statically, so the loading and error dialogs satisfy every assertion
  // below while being a different dialog from the one this contract describes.
  await expect(
    dialog.getByRole("radiogroup", { name: "Available models" }).getByRole("radio").first(),
  ).toBeVisible();
  const after = await readPageAnchors(page);

  // Scroll locking is compensated exactly once and never by transforming the
  // page, so the shell and the body stay exactly where they were.
  expect(after.shell).toEqual(before.shell);
  expect(after.body).toEqual(before.body);
  expect(after.scrollY).toBe(before.scrollY);
  expect(before.bodyTransform).toBe("none");
  expect(after.bodyTransform).toBe("none");

  const chips = dialog.getByRole("radiogroup", { name: "Model tier filter" }).getByRole("radio");
  await expect(chips.first()).toBeVisible();
  const heights = await measureHeights(chips);
  expect(heights.length).toBeGreaterThan(0);
  for (const height of heights) {
    expect(height).toBeLessThanOrEqual(28);
  }
});

/**
 * Enough rows to overflow the list's 50dvh cap at the desktop viewport; with the
 * two-model fixture the scroll contract below would pass without ever scrolling.
 */
const LONG_MODEL_DISCOVERY_RESPONSE = ConfigurationModelsResponseSchema.parse({
  ...MODEL_DISCOVERY_RESPONSE,
  models: Array.from({ length: 14 }, (_, index) => ({
    id: `gemini-row-${index}`,
    name: `Gemini Row ${index}`,
    description: "Scroll fixture",
    tier: index % 2 === 0 ? "free" : "paid",
  })),
});

/** The focused row's clearance from the model-list scrollport, in one synchronous read. */
async function readFocusedRowClearance(page: Page) {
  return page.evaluate(() => {
    const scroller = document.querySelector('[data-layout-region="model-list"]');
    const row = document.activeElement;
    if (!scroller || !(row instanceof HTMLElement)) {
      throw new Error("model-list scroller or focused row missing");
    }
    const scrollerBox = scroller.getBoundingClientRect();
    const rowBox = row.getBoundingClientRect();
    return {
      role: row.getAttribute("role"),
      topClearance: rowBox.top - scrollerBox.top,
      bottomClearance: scrollerBox.bottom - rowBox.bottom,
      overflows: scroller.scrollHeight > scroller.clientHeight,
    };
  });
}

test("arrow navigation keeps the highlighted model row's focus ring unclipped", async ({
  page,
}) => {
  await mockAppApi(page);
  await page.route("**/api/config/providers/*/models", (route) =>
    route.fulfill({ json: LONG_MODEL_DISCOVERY_RESPONSE }),
  );
  await page.goto("/settings/providers");

  await page.getByRole("option", { name: /Google Gemini/ }).click();
  await page.getByRole("button", { name: /Select model/i }).click();
  const dialog = page.getByRole("dialog", { name: "Select Model" });
  const radios = dialog.getByRole("radiogroup", { name: "Available models" }).getByRole("radio");
  await expect(radios).toHaveCount(14);
  // The dialog opens with the list zone active and the first row focused, so
  // 13 steps reach the last row and 13 more return, never crossing a boundary.
  await expect(radios.first()).toBeFocused();

  // Navigation scrolls rows via scrollIntoView({block: "nearest"}), which without
  // scroll-padding parks them flush with the clipped edge and cuts the focus ring
  // painted 1px outside the border box. The contract: after every step the row
  // keeps at least ring-width clearance on both clipped edges.
  const RING_WIDTH = 1;
  const walk = async (key: "ArrowDown" | "ArrowUp", steps: number) => {
    for (let step = 0; step < steps; step += 1) {
      await page.keyboard.press(key);
      const clearance = await readFocusedRowClearance(page);
      expect(clearance.role).toBe("radio");
      expect(clearance.overflows).toBe(true);
      expect(clearance.topClearance).toBeGreaterThanOrEqual(RING_WIDTH);
      expect(clearance.bottomClearance).toBeGreaterThanOrEqual(RING_WIDTH);
    }
  };
  await walk("ArrowDown", 13);
  await walk("ArrowUp", 13);
});
