import { ConfigurationModelsResponseSchema } from "@diffgazer/core/schemas/config";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { mockProtectedProviderApi, ONBOARDING_E2E_INIT } from "./provider-fixture";

const safeAreaInsets = { top: 40, right: 36, bottom: 56, left: 48 };

async function boxOf(locator: Locator, name: string) {
  const box = await locator.boundingBox();
  if (!box) throw new Error(`${name} has no bounding box`);
  return box;
}

async function emulateSafeArea(page: Page) {
  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setSafeAreaInsetsOverride", { insets: safeAreaInsets });
}

async function mockOnboardingApi(page: Page) {
  await page.route("**/api/health", (route) => route.fulfill({ status: 200, json: { ok: true } }));
  await page.route("**/api/settings", (route) =>
    route.fulfill({ json: ONBOARDING_E2E_INIT.settings }),
  );
  await page.route("**/api/config/init", (route) => route.fulfill({ json: ONBOARDING_E2E_INIT }));
  await page.route("**/api/config/providers", (route) =>
    route.fulfill({
      json: {
        schemaVersion: 2,
        configurations: ONBOARDING_E2E_INIT.configurations,
        selectedConfigurationId: ONBOARDING_E2E_INIT.selectedConfigurationId,
      },
    }),
  );
}

/**
 * Twelve rows, built through the discovery schema. Both halves matter: the
 * response has to parse *and* carry the identity of the configuration the
 * dialog asked about, or the dialog renders its error strip and the layout
 * contract below measures that instead; and enough rows have to arrive to
 * outgrow the list's height cap, which the test then measures.
 */
const MODEL_DISCOVERY_RESPONSE = ConfigurationModelsResponseSchema.parse({
  status: "passed",
  configurationId: "gemini-primary",
  productId: "gemini",
  transportFamily: "hosted-api",
  models: Array.from({ length: 12 }, (_, index) => ({
    id: `gemini-2.5-flash-${index}`,
    name: `Gemini 2.5 Flash ${index}`,
    description: "Fast model",
    tier: index % 2 === 0 ? "free" : "paid",
  })),
  checkedAt: "2026-01-01T00:00:00.000Z",
  source: "snapshot",
  cached: false,
});

async function mockProviderApi(page: Page) {
  await mockProtectedProviderApi(page);
  await page.route("**/api/config/providers/gemini-primary/models", (route) =>
    route.fulfill({ json: MODEL_DISCOVERY_RESPONSE }),
  );
}

test("onboarding progress renders the compact stepper at every width", async ({ page }) => {
  await mockOnboardingApi(page);
  await page.goto("/onboarding", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { level: 1, name: /select product/i })).toBeVisible();

  const progress = page.getByRole("list", { name: "Setup progress" });
  await expect(progress).toBeVisible();
  await expect(progress.getByRole("listitem")).toHaveCount(6);

  const active = progress.locator("li[aria-current='step']");
  await expect(active).toHaveCount(1);
  await expect(page.getByText("Step 1 of 6: Product")).toBeVisible();
  await expect(active).toContainText("Product");
});

test("the setup panel readout label stays put when focus enters the pane", async ({ page }) => {
  await mockOnboardingApi(page);
  await page.goto("/onboarding", { waitUntil: "domcontentloaded" });

  const panel = page.getByRole("region", { name: /select product/i });
  const label = panel.locator('[data-slot="panel-label"][data-variant="readout"]');
  await expect(label).toBeVisible();

  // The step's product list takes focus on arrival, so the pane starts focused and
  // the resting shape is reached by taking focus back out of it.
  await expect(panel).toHaveAttribute("data-state", "focused");
  const panelBox = await boxOf(panel, "setup panel");
  const focused = await boxOf(label, "focused readout label");

  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await expect(panel).not.toHaveAttribute("data-state", "focused");
  const resting = await boxOf(label, "resting readout label");

  // The readout is seated past the bracket arm the focused pane draws. The resting
  // pane draws none, so the inset has to hold on its own — otherwise the label
  // drops onto the panel corner and slides 30px the moment focus comes back.
  expect(resting.x - panelBox.x).toBeGreaterThan(20);
  expect(resting.x).toBeCloseTo(focused.x, 1);
  expect(resting.y).toBeCloseTo(focused.y, 1);
});

test("provider panes and controls adapt to the rendered viewport", async ({ page }, testInfo) => {
  await mockProviderApi(page);
  await page.goto("/settings/providers");

  const listPane = page.locator('[data-layout-pane="provider-list"]');
  await expect(listPane).toBeVisible();
  await page.getByRole("option", { name: /Google Gemini/ }).click();
  const detailsPane = page.locator('[data-layout-pane="provider-details"]');
  await expect(detailsPane).toBeVisible();

  const listBounds = await listPane.boundingBox();
  const detailsBounds = await detailsPane.boundingBox();
  expect(listBounds).not.toBeNull();
  expect(detailsBounds).not.toBeNull();

  if (testInfo.project.name === "mobile-chromium") {
    expect(detailsBounds?.y).toBeGreaterThanOrEqual(
      (listBounds?.y ?? 0) + (listBounds?.height ?? 0),
    );
    expect(detailsBounds?.width).toBeLessThanOrEqual(page.viewportSize()?.width ?? 0);

    // The filter row is a single-select ToggleGroup, so its items are radios:
    // querying buttons here would iterate nothing and pass without measuring.
    const coarseTargets = await page
      .getByRole("radiogroup", { name: "Provider filter" })
      .getByRole("radio")
      .all();
    expect(coarseTargets.length).toBeGreaterThan(0);
    for (const target of coarseTargets) {
      const bounds = await target.boundingBox();
      expect(bounds?.height).toBeGreaterThanOrEqual(44);
    }
  } else {
    expect(detailsBounds?.x).toBeGreaterThanOrEqual(
      (listBounds?.x ?? 0) + (listBounds?.width ?? 0),
    );
  }

  const selectConfiguration = detailsPane.getByRole("button", { name: /Select configuration/i });
  const updateConfiguration = detailsPane.getByRole("button", { name: /Update configuration/i });
  const firstButton = await selectConfiguration.boundingBox();
  const secondButton = await updateConfiguration.boundingBox();
  expect(firstButton).not.toBeNull();
  expect(secondButton).not.toBeNull();
  if (testInfo.project.name === "mobile-chromium") {
    expect(secondButton?.y).toBeGreaterThanOrEqual(
      (firstButton?.y ?? 0) + (firstButton?.height ?? 0),
    );
  } else {
    expect(secondButton?.x).toBeGreaterThanOrEqual(
      (firstButton?.x ?? 0) + (firstButton?.width ?? 0),
    );
  }

  await page.getByRole("button", { name: /Select model/i }).click();
  const dialog = page.getByRole("dialog", { name: "Select Model" });
  await expect(dialog).toBeVisible();
  // Measure the discovered list, not the loading or error shape that replaces it.
  const modelRows = dialog.getByRole("radiogroup", { name: "Available models" }).getByRole("radio");
  await expect(modelRows.first()).toBeVisible();
  const modelList = dialog.locator('[data-layout-region="model-list"]');
  const listBox = await modelList.boundingBox();
  // The rows outgrow the region, so the cap below is what holds the dialog to
  // half the viewport rather than the fixture happening to be short enough.
  const rowsHeight = await modelRows.evaluateAll((nodes) =>
    nodes.reduce((total, node) => total + node.getBoundingClientRect().height, 0),
  );
  expect(rowsHeight).toBeGreaterThan(listBox?.height ?? 0);
  expect(listBox?.height).toBeLessThanOrEqual((page.viewportSize()?.height ?? 0) / 2);

  if (testInfo.project.name === "mobile-chromium") {
    const modelTargets = await dialog
      .getByRole("radiogroup", { name: "Model tier filter" })
      .getByRole("radio")
      .all();
    expect(modelTargets.length).toBeGreaterThan(0);
    for (const target of modelTargets) {
      const bounds = await target.boundingBox();
      expect(bounds?.height).toBeGreaterThanOrEqual(44);
    }
  }
});

test("the rendered app shell consumes nonzero safe-area insets", async ({ page }, testInfo) => {
  await emulateSafeArea(page);
  await mockProviderApi(page);
  await page.goto("/testing/fixtures/results-layout.html?view=shell");

  const shell = page.locator('[data-layout="app-shell"]');
  await expect(shell).toBeVisible();

  // The shell owns every safe-area inset, including the bottom, so no child has to
  // stay mounted as a spacer to keep content clear of the home indicator.
  const shellStyles = await shell.evaluate((element) => {
    const computed = getComputedStyle(element);
    return {
      paddingTop: computed.paddingTop,
      paddingRight: computed.paddingRight,
      paddingBottom: computed.paddingBottom,
      paddingLeft: computed.paddingLeft,
    };
  });
  expect(shellStyles).toEqual({
    paddingTop: "40px",
    paddingRight: "36px",
    paddingBottom: "56px",
    paddingLeft: "48px",
  });

  const footer = page.locator("footer");
  const shortcutLegend = page.locator("[data-shortcut-legend]");
  const asciiWordmark = page.getByRole("img", { name: "diffgazer" });

  if (testInfo.project.name === "mobile-chromium") {
    // Coarse pointer has no keyboard legend, so the footer is removed rather than
    // left as a contentless bg-foreground strip; the bottom inset lives on the shell.
    // The ascii wordmark is the only brand rendering — it scales instead of
    // swapping to plain text on narrow viewports.
    await expect(footer).toBeHidden();
    await expect(shortcutLegend).toBeHidden();
    await expect(asciiWordmark).toBeVisible();
  } else {
    await expect(footer).toBeVisible();
    await expect(shortcutLegend).toBeVisible();
    const footerPaddingBottom = await footer.evaluate(
      (element) => getComputedStyle(element).paddingBottom,
    );
    expect(footerPaddingBottom).toBe("8px");
    await expect(asciiWordmark).toBeVisible();
  }
});

test("toast edges and coarse-pointer relocation use compiled positioning styles", async ({
  page,
}, testInfo) => {
  await emulateSafeArea(page);
  const position = testInfo.project.name === "mobile-chromium" ? "bottom-right" : "top-left";
  await page.goto(`/testing/fixtures/results-layout.html?view=toast&position=${position}`);
  await page.getByRole("button", { name: "Show notification" }).click();

  const region = page.getByRole("region", { name: "Notifications" });
  await expect(region.getByRole("status").getByText("Rendered notification")).toBeVisible();
  const styles = await region.evaluate((element) => {
    const computed = getComputedStyle(element);
    return {
      top: computed.top,
      right: computed.right,
      bottom: computed.bottom,
      left: computed.left,
      flexDirection: computed.flexDirection,
    };
  });
  const bounds = await region.boundingBox();
  expect(bounds).not.toBeNull();

  if (testInfo.project.name === "mobile-chromium") {
    expect(styles).toMatchObject({ top: "40px", right: "36px" });
    expect(bounds?.y).toBe(40);
    expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBe(
      (page.viewportSize()?.width ?? 0) - safeAreaInsets.right,
    );
    expect(styles.flexDirection).toBe("column");
  } else {
    expect(styles).toMatchObject({ top: "40px", left: "48px" });
    expect(bounds?.x).toBe(48);
    expect(bounds?.y).toBe(40);
    expect(styles.flexDirection).toBe("column");

    await page.goto("/testing/fixtures/results-layout.html?view=toast&position=bottom-right");
    await page.getByRole("button", { name: "Show notification" }).click();
    const bottomRegion = page.getByRole("region", { name: "Notifications" });
    await expect(bottomRegion.getByRole("status")).toBeVisible();
    const bottomBounds = await bottomRegion.boundingBox();
    expect(bottomBounds).not.toBeNull();
    expect((bottomBounds?.x ?? 0) + (bottomBounds?.width ?? 0)).toBe(
      (page.viewportSize()?.width ?? 0) - safeAreaInsets.right,
    );
    expect((bottomBounds?.y ?? 0) + (bottomBounds?.height ?? 0)).toBe(
      (page.viewportSize()?.height ?? 0) - safeAreaInsets.bottom,
    );
  }
});

test("typing in the providers search keeps the layout stable", async ({ page }) => {
  await page.goto("/testing/fixtures/results-layout.html?view=providers");
  const search = page.locator('[data-slot="search-input"]').first();
  await expect(search).toBeVisible();
  const filters = page.getByRole("radiogroup").or(page.getByRole("group")).first();
  const before = await search.boundingBox();
  const filtersBefore = await filters.boundingBox();

  await page.getByRole("searchbox", { name: "Search providers" }).fill("f");
  await expect(page.getByRole("button", { name: "Clear search" })).toBeVisible();

  const after = await search.boundingBox();
  const filtersAfter = await filters.boundingBox();
  expect(after?.height).toBe(before?.height);
  expect(after?.y).toBe(before?.y);
  expect(filtersAfter?.y).toBe(filtersBefore?.y);
});

const sweepViews = ["results", "summary", "providers", "shell", "toast"] as const;
const sweepViewports = [
  { width: 390, height: 844 },
  { width: 1280, height: 800 },
] as const;

// One case per view/viewport pair: a single case sweeping all ten combinations spent
// most of the default 30s budget and timed out under parallel load.
for (const size of sweepViewports) {
  for (const view of sweepViews) {
    test(`the ${view} view does not over-scroll the document at ${size.width}x${size.height}`, async ({
      page,
    }) => {
      await mockProviderApi(page);
      await page.setViewportSize(size);
      await page.goto(`/testing/fixtures/results-layout.html?view=${view}`);
      await page.waitForFunction(() => {
        const root = document.getElementById("root");
        if (!root) return false;
        return Array.from(root.children).some((child) => {
          const rect = child.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        });
      });

      const scroll = await page.evaluate(() => ({
        scrollHeight: document.documentElement.scrollHeight,
        clientHeight: document.documentElement.clientHeight,
      }));

      expect(
        scroll.scrollHeight,
        `view=${view} at ${size.width}x${size.height} must not extend the document past the viewport`,
      ).toBe(scroll.clientHeight);
    });
  }
}

test("the live providers empty-state stays contained by its scroll parent", async ({ page }) => {
  await mockProviderApi(page);
  await page.goto("/testing/fixtures/results-layout.html?view=providers");
  await expect(page.getByRole("option", { name: /Google Gemini/ })).toBeVisible();

  const liveEmptyState = page.locator('[data-slot="empty-state"][role="status"]');
  await expect(liveEmptyState).toHaveClass(/sr-only/);

  // The sr-only (position:absolute) live region must resolve its offsetParent to a
  // positioned ancestor inside the app shell, never escaping to the document body
  // where it could re-open the W-01 whole-document over-scroll.
  const escapesShell = await liveEmptyState.evaluate((element) => {
    const parent = (element as HTMLElement).offsetParent;
    return parent === null || parent === document.body || parent === document.documentElement;
  });
  expect(escapesShell).toBe(false);
});

test("the footer never leaves a contentless strip inside the mobile viewport", async ({
  page,
}, testInfo) => {
  await mockProviderApi(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/testing/fixtures/results-layout.html?view=shell");
  await expect(page.locator('[data-layout="app-shell"]')).toBeVisible();

  const footer = page.locator("footer");
  if (testInfo.project.name === "mobile-chromium") {
    // Coarse pointer removes the keyboard legend, so the footer is gone rather than
    // pinned to the bottom as an empty bg-foreground bar that reads as a clipped footer.
    await expect(footer).toBeHidden();
  } else {
    await expect(footer).toBeVisible();
    const box = await footer.boundingBox();
    expect(box).not.toBeNull();
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(844);
  }
});

test("the fine-pointer footer legend stays one scrollable row at narrow widths", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === "mobile-chromium",
    "the footer is coarse-pointer-hidden; silent clipping is a fine-pointer contract",
  );
  await mockProviderApi(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/testing/fixtures/results-layout.html?view=shell&legend=long");

  const footer = page.locator("footer");
  await expect(footer).toBeVisible();
  // The longest real legend (history "runs" zone) must be published before measuring.
  await expect(footer.getByText("Open Review")).toBeVisible();

  // Below sm the legend is one compact row that scrolls horizontally: no second
  // line, no tall footer, and every shortcut reachable by scrolling the legend.
  const measure = await footer.evaluate((element) => {
    const legend = element.querySelector("[data-shortcut-legend]") as HTMLElement;
    const legendRect = legend.getBoundingClientRect();
    legend.scrollLeft = legend.scrollWidth;
    const items = Array.from(legend.querySelectorAll<HTMLElement>(":scope > div > span"));
    const last = items.at(-1);
    if (!last) throw new Error("legend rendered no shortcut items");
    return {
      singleRow: legend.scrollHeight <= legendRect.height + 1,
      footerHeight: element.getBoundingClientRect().height,
      lastReachable: last.getBoundingClientRect().right <= legendRect.right + 0.5,
      lastText: last.textContent?.replace(/\s+/g, " ").trim() ?? "",
    };
  });

  expect(measure.singleRow).toBe(true);
  expect(measure.footerHeight).toBeLessThanOrEqual(30);
  expect(measure.lastReachable).toBe(true);
  expect(measure.lastText.length).toBeGreaterThan(0);
});

test("the ascii wordmark scales to fit narrow viewports", async ({ page }) => {
  await mockProviderApi(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/testing/fixtures/results-layout.html?view=shell");

  const logo = page.getByRole("img", { name: "diffgazer" });
  await expect(logo).toBeVisible();
  const metrics = await logo.evaluate((element) => ({
    width: element.getBoundingClientRect().width,
    docOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  }));
  expect(metrics.width).toBeGreaterThan(0);
  expect(metrics.width).toBeLessThanOrEqual(390);
  expect(metrics.docOverflow).toBe(false);
});

test("the banner wordmark keeps clear of both mobile viewport edges", async ({ page }) => {
  await mockProviderApi(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/settings");

  const logo = page.getByRole("img", { name: "diffgazer" });
  await expect(logo).toBeVisible();

  const metrics = await logo.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      width: rect.width,
      left: rect.left,
      right: rect.right,
      docOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });

  // The banner tier is the widest rendering the app ships. On a phone it scales
  // down to at most 90vw and keeps a 16px gutter either side, so the art is never
  // clipped at the edge and never widens the document.
  expect(metrics.width).toBeLessThanOrEqual(390 * 0.9);
  expect(metrics.left).toBeGreaterThanOrEqual(16);
  expect(metrics.right).toBeLessThanOrEqual(390 - 16);
  expect(metrics.docOverflow).toBe(false);
});

test("touch handlers do not hijack or reset the results list scroll position", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "mobile-chromium",
    "coarse-pointer scroll symmetry is the touch-device contract",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/testing/fixtures/results-layout.html?view=results");

  const scroller = page.locator("[data-list-body]");
  await expect(scroller).toBeVisible();

  const result = await scroller.evaluate((node) => {
    const element = node as HTMLElement;
    const dispatchTouch = (type: string, clientY: number) => {
      const touch = new Touch({ identifier: 1, target: element, clientX: 12, clientY });
      const ended = type === "touchend";
      element.dispatchEvent(
        new TouchEvent(type, {
          bubbles: true,
          cancelable: true,
          touches: ended ? [] : [touch],
          targetTouches: ended ? [] : [touch],
          changedTouches: [touch],
        }),
      );
    };

    const origin = element.scrollTop;
    const maxScroll = element.scrollHeight - element.clientHeight;

    dispatchTouch("touchstart", 640);
    dispatchTouch("touchmove", 240);
    element.scrollTop = element.scrollHeight;
    dispatchTouch("touchend", 240);
    const afterDown = element.scrollTop;

    dispatchTouch("touchstart", 240);
    dispatchTouch("touchmove", 640);
    element.scrollTop = origin;
    dispatchTouch("touchend", 640);
    const afterUp = element.scrollTop;

    return { origin, maxScroll, afterDown, afterUp };
  });

  if (result.maxScroll > 0) {
    expect(result.afterDown).toBeGreaterThan(result.origin);
  }
  expect(result.afterUp).toBe(result.origin);
});

test("the stacked providers view owns exactly one scroller and reaches the details pane", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "mobile-chromium",
    "the stacked mobile layout owns the page scroller",
  );
  await mockProviderApi(page);
  await page.setViewportSize({ width: 390, height: 560 });
  await page.goto("/testing/fixtures/results-layout.html?view=providers");

  const listPane = page.locator('[data-layout-pane="provider-list"]');
  await expect(listPane).toBeVisible();

  // Below md the page scroller is the ONLY vertical scroller: the provider list
  // grows intrinsically instead of nesting a second scroll region inside it.
  const verticalScrollers = await page.evaluate(() => {
    const found: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("*"))) {
      const style = getComputedStyle(el);
      if (/(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 2) {
        found.push(`${el.tagName}.${`${el.className}`.split(" ").slice(0, 3).join(".")}`);
      }
    }
    return found;
  });
  expect(verticalScrollers).toHaveLength(1);

  // The visually hidden live empty-state must not add phantom scroll height.
  const emptyStateHeight = await listPane.evaluate((pane) => {
    const emptyState = pane.querySelector('[data-slot="empty-state"]');
    return emptyState ? emptyState.getBoundingClientRect().height : null;
  });
  expect(emptyStateHeight).not.toBeNull();
  expect(emptyStateHeight ?? 0).toBeLessThanOrEqual(2);

  // Wheel input anywhere over the visible part of the list reaches the details
  // pane below the fold. The pane is taller than the viewport, so its midpoint
  // can land past the fold where a wheel event hits nothing — sample a point
  // that is both over the pane and on screen.
  const listBox = await listPane.boundingBox();
  if (!listBox) throw new Error("provider list has no bounding box");
  const wheelY = Math.min(listBox.y + listBox.height / 2, 520);
  await page.mouse.move(listBox.x + listBox.width / 2, wheelY);
  for (let step = 0; step < 6; step++) {
    await page.mouse.wheel(0, 400);
  }

  const detailsBox = await page.locator('[data-layout-pane="provider-details"]').boundingBox();
  if (!detailsBox) throw new Error("provider details has no bounding box");
  expect(detailsBox.y).toBeLessThan(560);
});

test("the review progress screen stacks into the page scroller on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/testing/fixtures/results-layout.html?view=progress");

  const logPanel = page.locator('[data-pane="log"]');
  await expect(logPanel).toBeVisible();

  const geometry = await page.evaluate(() => {
    const doc = document.documentElement;
    const panel = document.querySelector('[data-pane="log"]');
    if (!panel) throw new Error("log pane missing");
    const panelRect = panel.getBoundingClientRect();
    const filterGroup = document.querySelector('[aria-label="Agent filter"]');
    const chips = filterGroup
      ? Array.from(filterGroup.querySelectorAll<HTMLElement>("button, [role='radio']"))
      : [];
    const escapedChips = chips.filter((chip) => {
      const rect = chip.getBoundingClientRect();
      return (
        rect.right > panelRect.right + 0.5 ||
        rect.left < panelRect.left - 0.5 ||
        rect.bottom > panelRect.bottom + 0.5
      );
    }).length;
    const scrollers: { containsLogPane: boolean; insideLogPane: boolean }[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("*"))) {
      const style = getComputedStyle(el);
      if (/(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 2) {
        scrollers.push({
          containsLogPane: el.contains(panel),
          insideLogPane: panel.contains(el) && el !== panel,
        });
      }
    }
    return {
      hOverflow: doc.scrollWidth > doc.clientWidth,
      chipCount: chips.length,
      escapedChips,
      scrollers,
    };
  });

  expect(geometry.hOverflow).toBe(false);
  expect(geometry.chipCount).toBeGreaterThanOrEqual(5);
  expect(geometry.escapedChips).toBe(0);
  // The page scroller owns the stack; the live activity log keeps its bounded
  // tail scroller as the one deliberate nested-scroll exception.
  expect(geometry.scrollers.length).toBeLessThanOrEqual(2);
  // The page-level stacker (an ancestor of the log pane) owns the scroll; the
  // only other allowed scroller is the bounded activity-log tail inside it.
  expect(geometry.scrollers.some((s) => s.containsLogPane)).toBe(true);
  expect(geometry.scrollers.every((s) => s.containsLogPane || s.insideLogPane)).toBe(true);

  // Selecting an agent chip inverts its badge like every other selection surface.
  const detective = page.locator('[aria-label="Agent filter"] [data-value="Detective"]');
  const badge = detective.locator('[data-slot="badge"]');
  const colorBefore = await badge.evaluate((el) => getComputedStyle(el).color);
  await detective.click();
  await expect(detective).toHaveAttribute("data-state", "on");
  const colorAfter = await badge.evaluate((el) => getComputedStyle(el).color);
  expect(colorAfter).not.toBe(colorBefore);
});
