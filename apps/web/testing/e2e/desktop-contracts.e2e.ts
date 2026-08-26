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

/** Any valid uuid resolves the review route; the gate below never reads it back. */
const GATE_REVIEW_ID = "11111111-1111-4111-8111-111111111111";

async function mockAppApi(page: Page) {
  await mockProtectedProviderApi(page);
  // Diagnostics reads the workspace context snapshot. 404 is the "never generated"
  // answer and is not retried, so the panel settles into one geometry to measure.
  await page.route("**/api/review/context", (route) =>
    route.fulfill({ status: 404, json: { error: "context not generated" } }),
  );
  // The no-changes gate is the whole review stream: it ends in NO_DIFF before a
  // single step lands, so one SSE frame renders the screen this file measures.
  await page.route("**/api/review/reviews/*/stream", (route) =>
    route.fulfill({
      status: 200,
      headers: { "content-type": "text/event-stream" },
      body: `event: error\ndata: ${JSON.stringify({
        type: "error",
        error: { code: "NO_DIFF", message: "No unstaged changes found." },
      })}\n\n`,
    }),
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

/**
 * A webfont swap moves layout by a pixel, and on a scrolled page it moves the scroll
 * position with it. Every geometry contract here compares boxes read in separate
 * protocol calls, so a swap landing between two reads shows up as a 1px drift in a
 * pair that is actually aligned. Waiting for the faces makes the reads comparable.
 */
async function settleFonts(page: Page) {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

function overlapsVertically(a: { y: number; height: number }, b: { y: number; height: number }) {
  return Math.max(a.y, b.y) < Math.min(a.y + a.height, b.y + b.height);
}

/** Rendered heights of every element a locator resolves to, in DOM order. */
async function measureHeights(locator: Locator): Promise<number[]> {
  return locator.evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
}

interface ClippedViewportGeometry {
  centerXDelta: number;
  centerYDelta: number;
  /** Panel top minus where the 1:2 hero band puts it inside the viewport's content box. */
  bandTopDelta: number;
  /** Panel top minus the top of that content box — zero once the spacers collapse. */
  contentTopDelta: number;
  /** Leftover height around the panel: any placement pin over zero spare is degenerate. */
  spare: number;
  /** The clipped viewport takes the overflow, so the page never scrolls. */
  scrolls: boolean;
  panelWidth: number;
  /** The clipped viewport's content-box width — what a full-bleed band spans. */
  viewportContentWidth: number;
}

/**
 * Where a panel sits inside the clipped viewport that owns it. The viewport is
 * found by walking up from the panel rather than by class name, because which
 * element clips differs per screen: the settings screens clip in their own
 * padded overflow-hidden wrapper, while help clips in the app shell's
 * overflow-hidden main content box (help's labelled scroll region lives inside
 * the measured panel, so nothing outside it scrolls). Overflow-hidden boxes
 * count as viewports alongside auto/scroll ones — the contract is about the
 * box the user sees, not the markup.
 */
async function measureInClippedViewport(panel: Locator): Promise<ClippedViewportGeometry> {
  return panel.evaluate((element) => {
    let scroller = element.parentElement;
    while (scroller) {
      const { overflowY } = getComputedStyle(scroller);
      if (overflowY === "auto" || overflowY === "scroll" || overflowY === "hidden") break;
      scroller = scroller.parentElement;
    }
    if (!scroller) throw new Error("the panel has no clipping ancestor");

    const scrollerRect = scroller.getBoundingClientRect();
    // clientLeft/clientTop plus clientWidth/clientHeight is the viewport itself:
    // borders and any scrollbar gutter drop out, so the centre compared against is
    // the box the panel is actually seen inside.
    const viewLeft = scrollerRect.left + scroller.clientLeft;
    const viewTop = scrollerRect.top + scroller.clientTop;
    const panelRect = element.getBoundingClientRect();

    // The hero band lives in the viewport's content box: spare height around
    // the panel splits 1:2, so the expected top offset is a third of the spare.
    const style = getComputedStyle(scroller);
    const paddingTop = Number.parseFloat(style.paddingTop);
    const contentHeight =
      scroller.clientHeight - paddingTop - Number.parseFloat(style.paddingBottom);
    const spare = Math.max(0, contentHeight - panelRect.height);

    return {
      centerXDelta: panelRect.left + panelRect.width / 2 - (viewLeft + scroller.clientWidth / 2),
      centerYDelta: panelRect.top + panelRect.height / 2 - (viewTop + scroller.clientHeight / 2),
      bandTopDelta: panelRect.top - (viewTop + paddingTop + spare / 3),
      contentTopDelta: panelRect.top - (viewTop + paddingTop),
      spare,
      scrolls: scroller.scrollHeight > scroller.clientHeight,
      panelWidth: panelRect.width,
      viewportContentWidth:
        scroller.clientWidth -
        Number.parseFloat(style.paddingLeft) -
        Number.parseFloat(style.paddingRight),
    };
  });
}

const SINGLE_PANEL_SCREENS = [
  // The hub's rows pair labels with values, so its card keeps the wider 3xl
  // tier while single-column settings children hold the shared 2xl width.
  {
    path: "/settings",
    panel: "Settings Hub",
    contentWidth: 768,
    vertical: "centre",
    spareHeight: "collapsed",
  },
  // The one settings card with real spare height at the desktop size, so it is
  // the screen that pins the band split itself rather than the collapsed centre.
  {
    path: "/settings/diagnostics",
    panel: "System Diagnostics",
    contentWidth: 672,
    vertical: "band",
    spareHeight: "real",
  },
  // Help is not a settings form and keeps its own wider large-screen tier, so
  // no width is pinned — only the placement half of the contract applies.
  {
    path: "/help",
    panel: "Help",
    contentWidth: null,
    vertical: "centre",
    spareHeight: "real",
  },
  // A boxed dead-end gate with hundreds of pixels of spare at this size:
  // boxed gates dead-centre (the two-species rule below), so this row pins
  // the live centre, not the band. The other dead end — the 404 — is a
  // full-bleed interruption band with its own test below.
  {
    path: `/review/${GATE_REVIEW_ID}?live=true&mode=unstaged`,
    panel: "No Unstaged Changes",
    contentWidth: 448,
    vertical: "centre",
    spareHeight: "real",
  },
] as const;

test("single-panel screens centre and hold the hero band inside their clipped viewport", async ({
  page,
}) => {
  await mockAppApi(page);

  for (const screen of SINGLE_PANEL_SCREENS) {
    await page.goto(screen.path);
    // Exact: the help screen nests a labelled "Help content" scroll region
    // inside the measured "Help" panel, and role-name matching is substring by
    // default.
    const panel = page.getByRole("region", { name: screen.panel, exact: true });
    await expect(panel).toBeVisible();

    const geometry = await measureInClippedViewport(panel);
    expect(Math.abs(geometry.centerXDelta), `${screen.path} horizontal centre`).toBeLessThanOrEqual(
      1,
    );
    // Vertical: two species own this table. Sparse page cards and loading sit
    // in the app-wide 1:2 band; boxed dead-end gates dead-centre; the 404
    // interruption band is full-bleed in the 1:2 band with its own test.
    // A row marked "collapsed" has no room to place — its card fills the box
    // the helper measures — while a "real" row keeps leftover height, so its
    // placement assertion is live (help's 64px is the padding of its own
    // wrapper one level below main; its band is collapsed, so centre and band
    // coincide, which is what its "centre" row pins).
    if (screen.spareHeight === "real") {
      expect(geometry.spare, `${screen.path} spare height`).toBeGreaterThan(0);
    } else {
      expect(geometry.spare, `${screen.path} spare height`).toBe(0);
    }
    if (screen.vertical === "centre") {
      expect(Math.abs(geometry.centerYDelta), `${screen.path} vertical centre`).toBeLessThanOrEqual(
        1,
      );
    } else {
      expect(Math.abs(geometry.bandTopDelta), `${screen.path} hero band`).toBeLessThanOrEqual(1);
    }
    if (screen.contentWidth !== null) {
      expect(geometry.panelWidth, `${screen.path} content width`).toBe(screen.contentWidth);
    }
  }
});

test("the 404 interruption band spans the frame and holds the hero band", async ({ page }) => {
  await mockAppApi(page);
  await page.goto("/this-route-does-not-exist");

  const band = page.getByRole("region", { name: "Page Not Found", exact: true });
  await expect(band).toBeVisible();

  // The band is a strip, not a box: full bleed makes centerXDelta trivially 0,
  // so the width contract compares the section against the clipped viewport's
  // own content box instead of pinning a panel width.
  const geometry = await measureInClippedViewport(band);
  expect(
    Math.abs(geometry.panelWidth - geometry.viewportContentWidth),
    "full-bleed width",
  ).toBeLessThanOrEqual(1);
  // The 404 keeps the app-wide 1:2 band (boxed gates dead-centre instead), so
  // loading → 404 lands without a jump; a live placement needs real spare.
  expect(geometry.spare, "spare height").toBeGreaterThan(0);
  expect(Math.abs(geometry.bandTopDelta), "hero band").toBeLessThanOrEqual(1);
});

test.describe("a viewport too short for the dead-end panel", () => {
  test.use({ viewport: { width: 1280, height: 360 } });

  test("collapses the gate's spacers and scrolls its content area from the top", async ({
    page,
  }) => {
    await mockAppApi(page);
    await page.goto("/this-route-does-not-exist");

    const panel = page.getByRole("region", { name: "Page Not Found", exact: true });
    await expect(panel).toBeVisible();

    // Mount focus lands on the lone action at the band's bottom edge, and the
    // app's keyboard-first reveal scrolls it into view — so the content area
    // starts scrolled down here. The spacer-collapse contract is about the
    // band's geometry, not the reveal: read it with the area back at the top.
    await expect(page.getByRole("button", { name: "Go to Home" })).toBeFocused();
    await panel.evaluate((element) => {
      const scroller = element.parentElement;
      if (scroller) scroller.scrollTop = 0;
    });

    // Banding only distributes leftover height. With none left the spacers
    // collapse, the panel starts at the top of the content box, and the overflow
    // belongs to the clipped viewport — never to the page, whose shell is h-dvh.
    const geometry = await measureInClippedViewport(panel);
    expect(geometry.spare, "spare height").toBe(0);
    expect(Math.abs(geometry.contentTopDelta), "panel top").toBeLessThanOrEqual(1);
    expect(geometry.scrolls, "content area scrolls").toBe(true);

    const pageScrolls = await page.evaluate(
      () => document.documentElement.scrollHeight > document.documentElement.clientHeight,
    );
    expect(pageScrolls, "the page scrolls").toBe(false);
  });
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
  await settleFonts(page);
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
  await settleFonts(page);
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

/** The perimeter every pane draws (panel.css, frame="hairline"). */
const PANEL_BORDER = 1;
/**
 * The gutter each scroller's own padding leaves between the reserved scrollbar
 * track and the content: summary px-5 measures 20, help px-3.5 measures 14. The
 * clearance floors sit under those so a density change stays legal, while the bar
 * can never move back into the text column it used to be carved out of.
 */
const SUMMARY_PANE_PADDING = 20;
const SUMMARY_TRACK_CLEARANCE = 16;
const HELP_TRACK_CLEARANCE = 12;

interface ScrollerGeometry {
  /** Scroller edges measured from the panel's own edges: one border wide = flush. */
  leftInset: number;
  rightInset: number;
  /**
   * Inline start of the space-taking scrollbar track. `offsetWidth - clientWidth`
   * is the scroller's border plus that track, so subtracting it from the right edge
   * lands where the 6px bar begins - the edge content has to stay clear of.
   */
  track: number;
  /** Scroller left edge: the datum the content column's inset is measured from. */
  left: number;
}

/**
 * Where a pane's scroll region sits inside the panel that owns it. Both panes below
 * make the scroller the Panel's direct child and carry the pane padding on it, so the
 * reserved bar rides the pane's inner border and that padding is the gutter keeping it
 * off the glyphs. A padded wrapper between the two instead carves the bar out of the
 * text column, which is what these contracts guard against.
 */
async function readScrollerGeometry(region: Locator): Promise<ScrollerGeometry> {
  return region.evaluate((node) => {
    const scroller = node as HTMLElement;
    const panel = scroller.closest('[data-slot="panel"]');
    if (!panel) throw new Error("the scroll region has no panel");
    const panelRect = panel.getBoundingClientRect();
    const scrollerRect = scroller.getBoundingClientRect();
    return {
      leftInset: scrollerRect.left - panelRect.left,
      rightInset: panelRect.right - scrollerRect.right,
      track: scrollerRect.right - (scroller.offsetWidth - scroller.clientWidth),
      left: scrollerRect.left,
    };
  });
}

test("summary scrollbar rides the pane edge, clear of the content", async ({ page }) => {
  await page.goto("/testing/fixtures/app-fixture.html?view=summary");

  const scroller = page.getByRole("region", { name: "Review summary", exact: true });
  await expect(scroller).toBeVisible();
  await settleFonts(page);
  const geometry = await readScrollerGeometry(scroller);
  const runStatus = await boxOf(
    page.getByRole("region", { name: "Run status", exact: true }),
    "run status panel",
  );

  expect(geometry.leftInset, "summary scroller left edge").toBeCloseTo(PANEL_BORDER, 0);
  expect(geometry.rightInset, "summary scroller right edge").toBeCloseTo(PANEL_BORDER, 0);
  // The bar used to sit against the run-status border and 20px inside the pane:
  // the padding was on the wrapper around the scroller rather than on it.
  expect(
    geometry.track - (runStatus.x + runStatus.width),
    "summary content clear of the track",
  ).toBeGreaterThanOrEqual(SUMMARY_TRACK_CLEARANCE);
  expect(runStatus.x - geometry.left, "summary content column inset").toBeCloseTo(
    SUMMARY_PANE_PADDING,
    0,
  );
});

test("help sheet wears the pane mark and its scroller rides the pane edge", async ({ page }) => {
  await mockAppApi(page);
  await page.goto("/help");

  const sheet = page.getByRole("region", { name: "Help", exact: true });
  const region = page.getByRole("region", { name: "Help content", exact: true });
  await expect(sheet).toBeVisible();
  // The sheet opens with focus in its scroll region, so the pane mark is the
  // sheet's brackets and the region defers its own ring: one mark per screen.
  await expect(region).toBeFocused();
  await expect(sheet).toHaveAttribute("data-state", "focused");
  await expect(page.locator('[data-slot="panel-corners"]')).toHaveCount(1);
  await settleFonts(page);

  const geometry = await readScrollerGeometry(region);
  const paint = await region.evaluate((node) => {
    const scroller = node as HTMLElement;
    // Every shortcut row and the closing paragraph fill the content column, so the
    // widest right edge among them is the column's own edge - the one the bar
    // used to reach into.
    const rows = Array.from(scroller.querySelectorAll("li, p"));
    // The focused sheet firms its perimeter to --border-strong; resolve the token
    // through a probe so both sides compare as the same computed colour format.
    const sheet = scroller.closest<HTMLElement>('[data-slot="panel"]');
    const probe = document.createElement("span");
    probe.style.color = "var(--border-strong)";
    document.body.append(probe);
    const borderStrong = getComputedStyle(probe).color;
    probe.remove();
    return {
      outlineStyle: getComputedStyle(scroller).outlineStyle,
      textRight: Math.max(...rows.map((row) => row.getBoundingClientRect().right)),
      sheetBorder: sheet ? getComputedStyle(sheet).borderTopColor : null,
      borderStrong,
    };
  });

  expect(paint.outlineStyle, "help region outline").toBe("none");
  expect(paint.sheetBorder, "focused help sheet border is --border-strong").toBe(
    paint.borderStrong,
  );
  expect(geometry.leftInset, "help scroller left edge").toBeCloseTo(PANEL_BORDER, 0);
  expect(geometry.rightInset, "help scroller right edge").toBeCloseTo(PANEL_BORDER, 0);
  expect(geometry.track - paint.textRight, "help text clear of the track").toBeGreaterThanOrEqual(
    HELP_TRACK_CLEARANCE,
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
  await page.getByRole("button", { name: /Change model/i }).click();
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
  await page.getByRole("button", { name: /Change model/i }).click();
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
