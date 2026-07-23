import { expect, type Page, test } from "@playwright/test";

const providers = [
  { provider: "gemini", hasApiKey: true, isActive: true, model: "gemini-2.5-flash" },
  { provider: "openrouter", hasApiKey: true, isActive: false, model: "openai/gpt-4o" },
];

const initResponse = {
  configPath: "/tmp/diffgazer/config.json",
  config: { provider: "gemini", model: "gemini-2.5-flash" },
  configured: true,
  project: { projectId: "responsive-contract", path: "/repo", trust: null },
  providers,
  settings: {
    agentExecution: "parallel",
    defaultLenses: ["correctness"],
    defaultProfile: null,
    secretsStorage: "file",
    severityThreshold: "low",
    theme: "terminal",
  },
  setup: {
    hasModel: true,
    hasProvider: true,
    hasSecretsStorage: true,
    hasTrust: false,
    isConfigured: true,
    isReady: true,
    missing: [],
  },
};

const safeAreaInsets = { top: 40, right: 36, bottom: 56, left: 48 };

async function emulateSafeArea(page: Page) {
  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setSafeAreaInsetsOverride", { insets: safeAreaInsets });
}

const onboardingInitResponse = {
  configPath: "/tmp/diffgazer/config.json",
  config: { provider: "gemini", model: "gemini-2.5-flash" },
  configured: false,
  project: { projectId: "onboarding-responsive", path: "/repo", trust: null },
  providers: [{ provider: "gemini", hasApiKey: false, isActive: false }],
  settings: {
    agentExecution: "parallel",
    defaultLenses: ["correctness"],
    defaultProfile: null,
    secretsStorage: null,
    severityThreshold: "low",
    theme: "terminal",
  },
  setup: {
    hasModel: false,
    hasProvider: false,
    hasSecretsStorage: false,
    hasTrust: false,
    isConfigured: false,
    isReady: false,
    missing: ["secretsStorage", "provider", "model"],
  },
};

async function mockOnboardingApi(page: Page) {
  await page.route("**/api/health", (route) => route.fulfill({ status: 200, json: { ok: true } }));
  await page.route("**/api/settings", (route) =>
    route.fulfill({ json: onboardingInitResponse.settings }),
  );
  await page.route("**/api/config/init", (route) =>
    route.fulfill({ json: onboardingInitResponse }),
  );
  await page.route("**/api/config/providers", (route) =>
    route.fulfill({
      json: {
        providers: onboardingInitResponse.providers,
      },
    }),
  );
}

async function mockProviderApi(page: Page) {
  await page.route("**/api/config/init", (route) => route.fulfill({ json: initResponse }));
  await page.route("**/api/config/providers", (route) =>
    route.fulfill({ json: { providers, activeProvider: "gemini" } }),
  );
  await page.route("**/api/config/provider/gemini/models", (route) =>
    route.fulfill({
      json: {
        models: [
          {
            id: "gemini-2.5-flash",
            name: "Gemini 2.5 Flash",
            description: "Fast model",
            tier: "free",
          },
        ],
        fetchedAt: "2026-01-01T00:00:00.000Z",
        source: "snapshot",
        cached: false,
      },
    }),
  );
}

test("onboarding progress shows compact text below md and the full stepper at md and above", async ({
  page,
}, testInfo) => {
  await mockOnboardingApi(page);
  await page.goto("/onboarding", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { level: 1, name: /secrets storage/i })).toBeVisible();

  const compactProgress = page.getByText("Step 1/6 · Storage");
  const fullProgress = page.getByRole("list", { name: "Setup progress" });

  if (testInfo.project.name === "mobile-chromium") {
    await expect(compactProgress).toBeVisible();
    await expect(fullProgress).toBeHidden();
  } else {
    await expect(compactProgress).toBeHidden();
    await expect(fullProgress).toBeVisible();
  }
});

test("provider panes and controls adapt to the rendered viewport", async ({ page }, testInfo) => {
  await mockProviderApi(page);
  await page.goto("/testing/fixtures/results-layout.html?view=providers");

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

    const coarseTargets = page.getByRole("group", { name: "Provider filter" }).getByRole("button");
    for (const target of await coarseTargets.all()) {
      const bounds = await target.boundingBox();
      expect(bounds?.height).toBeGreaterThanOrEqual(44);
    }
  } else {
    expect(detailsBounds?.x).toBeGreaterThanOrEqual(
      (listBounds?.x ?? 0) + (listBounds?.width ?? 0),
    );
  }

  const capabilityGrid = page.locator('[data-layout-grid="provider-capabilities"]');
  const capabilityCards = capabilityGrid.locator("> div");
  const firstCard = await capabilityCards.nth(0).boundingBox();
  const secondCard = await capabilityCards.nth(1).boundingBox();
  expect(firstCard).not.toBeNull();
  expect(secondCard).not.toBeNull();
  if (testInfo.project.name === "mobile-chromium") {
    expect(secondCard?.y).toBeGreaterThanOrEqual((firstCard?.y ?? 0) + (firstCard?.height ?? 0));
  } else {
    expect(secondCard?.x).toBeGreaterThanOrEqual((firstCard?.x ?? 0) + (firstCard?.width ?? 0));
  }

  await page.getByRole("button", { name: "Select Model" }).click();
  const dialog = page.getByRole("dialog", { name: "Select Model" });
  await expect(dialog).toBeVisible();
  const modelList = dialog.locator('[data-layout-region="model-list"]');
  const listBox = await modelList.boundingBox();
  expect(listBox?.height).toBeLessThanOrEqual((page.viewportSize()?.height ?? 0) / 2);

  if (testInfo.project.name === "mobile-chromium") {
    const modelTargets = dialog
      .getByRole("group", { name: "Model tier filter" })
      .getByRole("button");
    for (const target of await modelTargets.all()) {
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
  const asciiWordmark = page.getByRole("img", { name: "DIFFGAZER" });

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

test("no fixture view over-scrolls the document at mobile or desktop widths", async ({ page }) => {
  await mockProviderApi(page);

  for (const size of sweepViewports) {
    await page.setViewportSize(size);
    for (const view of sweepViews) {
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
    }
  }
});

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

  const logo = page.getByRole("img", { name: "DIFFGAZER" });
  await expect(logo).toBeVisible();
  const metrics = await logo.evaluate((element) => ({
    width: element.getBoundingClientRect().width,
    docOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  }));
  expect(metrics.width).toBeGreaterThan(0);
  expect(metrics.width).toBeLessThanOrEqual(390);
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
        found.push(`${el.tagName}.${(el.className + "").split(" ").slice(0, 3).join(".")}`);
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

  // Wheel input anywhere over the list reaches the details pane below the fold.
  const listBox = await listPane.boundingBox();
  if (!listBox) throw new Error("provider list has no bounding box");
  await page.mouse.move(listBox.x + listBox.width / 2, listBox.y + listBox.height / 2);
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
