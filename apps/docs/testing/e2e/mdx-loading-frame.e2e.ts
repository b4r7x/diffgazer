import { expect, type Page, test } from "@playwright/test";

const RAIL_PROBE_ID = "toc-rail-presence-probe";
const SCROLLBAR_WIDTH_TOLERANCE_PX = 20;
/**
 * The centering script measures a scroll area one chrome row taller than the settled
 * one, so it lands up to half a row below the true center. Correcting that after
 * hydration would be a visible jump, so the tolerance absorbs it instead.
 */
const SIDEBAR_CENTER_TOLERANCE_PX = 24;
const RESTORED_MAIN_SCROLL_PX = 900;
/**
 * Article top padding plus the heading's scroll margin keep the anchor off the exact
 * edge. The budget only has to be small against the 1000px viewport this runs at.
 */
const HASH_ANCHOR_TOLERANCE_PX = 80;
/** Top of the document, the anchor, and the settle after the lazy MDX lays out. */
const MAX_HASH_ANCHOR_STEPS = 4;

declare global {
  interface Window {
    __mdxHydrationProbe?: {
      sawContent: boolean;
      lostContent: boolean;
    };
    __scrollJumpProbe?: {
      sidebar: number[];
      main: number[];
    };
  }
}

interface PageFrameGeometry {
  articleWidth: number | null;
  railWidth: number | null;
  railX: number | null;
}

function isMdxModuleRequest(url: string, pageName: string): boolean {
  const pathname = new URL(url).pathname;
  return (
    pathname.endsWith(`/content/docs/ui/components/${pageName}.mdx`) ||
    pathname.endsWith(`/content/legal/${pageName}.mdx`) ||
    new RegExp(`/assets/${pageName}-[A-Za-z0-9_-]+\\.js$`).test(pathname)
  );
}

async function capturePageFrame(page: Page): Promise<PageFrameGeometry> {
  return page.evaluate(() => {
    const rail = Array.from(document.querySelectorAll<HTMLElement>('nav[data-slot="toc"]')).find(
      (candidate) => candidate.getBoundingClientRect().width > 0,
    );
    const article =
      rail?.previousElementSibling instanceof HTMLElement ? rail.previousElementSibling : null;

    return {
      articleWidth: article?.getBoundingClientRect().width ?? null,
      railWidth: rail?.getBoundingClientRect().width ?? null,
      railX: rail?.getBoundingClientRect().x ?? null,
    };
  });
}

function expectFrameStable(actual: PageFrameGeometry, expected: PageFrameGeometry): void {
  for (const key of ["articleWidth", "railWidth", "railX"] as const) {
    const delta = Math.abs((actual[key] ?? Number.NaN) - (expected[key] ?? Number.NaN));
    expect(delta, key).toBeLessThanOrEqual(SCROLLBAR_WIDTH_TOLERANCE_PX);
  }
}

async function captureActiveSidebarCenterDelta(page: Page): Promise<number | null> {
  return page.evaluate(() => {
    const activePage = document.querySelector<HTMLElement>(
      '#sidebar-nav [data-slot="scroll-area"] [aria-current="page"]',
    );
    const scrollArea = activePage?.closest<HTMLElement>('[data-slot="scroll-area"]');
    if (!activePage || !scrollArea) return null;

    const activeRect = activePage.getBoundingClientRect();
    const scrollAreaRect = scrollArea.getBoundingClientRect();
    const activeCenter = activeRect.top + activeRect.height / 2;
    const scrollAreaCenter = scrollAreaRect.top + scrollAreaRect.height / 2;
    return Math.abs(activeCenter - scrollAreaCenter);
  });
}

test("keeps the docs article and desktop TOC rail stable while cold MDX navigation loads", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/ui/components/dialog");
  await expect(page.getByRole("heading", { level: 1, name: "Dialog" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "On this page" })).toBeVisible();

  const settled = await capturePageFrame(page);
  expect(settled.articleWidth).not.toBeNull();
  expect(settled.railWidth).not.toBeNull();
  expect(settled.railX).not.toBeNull();

  let releaseDestination: () => void = () => {};
  const destinationReleased = new Promise<void>((resolve) => {
    releaseDestination = resolve;
  });
  let destinationRequests = 0;
  await page.route("**/*", async (route) => {
    if (!isMdxModuleRequest(route.request().url(), "button")) {
      await route.continue();
      return;
    }
    destinationRequests += 1;
    await destinationReleased;
    await route.continue();
  });

  await page.evaluate((probeId) => {
    const container = document.getElementById("main-content");
    if (!container) throw new Error("Missing #main-content");

    const probe = document.createElement("span");
    probe.id = probeId;
    probe.hidden = true;
    probe.dataset.samples = "";
    document.body.append(probe);

    const sampleRailPresence = () => {
      const visibleRail = Array.from(
        document.querySelectorAll<HTMLElement>('nav[data-slot="toc"]'),
      ).some((candidate) => candidate.getBoundingClientRect().width > 0);
      probe.dataset.samples += visibleRail ? "1" : "0";
    };

    const observer = new MutationObserver(sampleRailPresence);
    observer.observe(container, { childList: true, subtree: true });
    probe.addEventListener("stop", () => observer.disconnect(), { once: true });
    sampleRailPresence();
  }, RAIL_PROBE_ID);

  const navigateToButton = page.getByRole("link", { name: "Button", exact: true }).first().click();
  try {
    await expect.poll(() => destinationRequests).toBeGreaterThan(0);

    const loadingStatus = page
      .getByRole("status")
      .filter({ hasText: "Loading documentation page" });
    await expect(loadingStatus).toBeVisible();
    await expect(loadingStatus).toHaveText("Loading documentation page");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(0);

    const pending = await capturePageFrame(page);
    expectFrameStable(pending, settled);
  } finally {
    releaseDestination();
  }

  await navigateToButton;
  await expect(page.getByRole("heading", { level: 1, name: "Button" })).toBeVisible();
  expectFrameStable(await capturePageFrame(page), settled);

  const railSamples = await page.evaluate((probeId) => {
    const probe = document.getElementById(probeId);
    probe?.dispatchEvent(new Event("stop"));
    return probe?.dataset.samples ?? "";
  }, RAIL_PROBE_ID);
  expect(railSamples).not.toBe("");
  expect(railSamples).not.toContain("0");
});

test("does not replace server-rendered docs with a fallback while the client hydrates", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(() => {
    const probe = { sawContent: false, lostContent: false };
    window.__mdxHydrationProbe = probe;

    const sample = () => {
      const hasContent = Array.from(document.querySelectorAll("h1")).some(
        (heading) => heading.textContent?.trim() === "Select",
      );
      if (hasContent) probe.sawContent = true;
      if (
        probe.sawContent &&
        (!hasContent ||
          Array.from(document.querySelectorAll("output")).some(
            (output) => output.textContent?.trim() === "Loading documentation page",
          ))
      ) {
        probe.lostContent = true;
      }
      requestAnimationFrame(sample);
    };

    window.addEventListener("DOMContentLoaded", () => requestAnimationFrame(sample), {
      once: true,
    });
  });

  let releaseContent: () => void = () => {};
  const contentReleased = new Promise<void>((resolve) => {
    releaseContent = resolve;
  });
  let contentRequests = 0;
  await page.route("**/*", async (route) => {
    if (!isMdxModuleRequest(route.request().url(), "select")) {
      await route.continue();
      return;
    }
    contentRequests += 1;
    await contentReleased;
    await route.continue();
  });

  const navigation = page.goto("/ui/components/select");
  try {
    await expect(page.getByRole("heading", { level: 1, name: "Select" })).toBeVisible();
    await expect.poll(() => contentRequests).toBeGreaterThan(0);
    await expect
      .poll(() => page.evaluate(() => window.__mdxHydrationProbe?.sawContent ?? false))
      .toBe(true);

    await expect(page.getByRole("heading", { level: 1, name: "Select" })).toBeVisible();
    await expect(
      page.getByRole("status").filter({ hasText: "Loading documentation page" }),
    ).toHaveCount(0);
    await expect(page.locator('nav[data-slot="toc"][aria-hidden="true"]')).toBeVisible();
    await expect
      .poll(() => captureActiveSidebarCenterDelta(page))
      .toBeLessThanOrEqual(SIDEBAR_CENTER_TOLERANCE_PX);
  } finally {
    releaseContent();
  }

  await navigation;
  const toc = page.getByRole("navigation", { name: "On this page" });
  await expect(toc).toContainText("SelectItem");

  // The skeleton carries no links, so this catches a client that never hydrated —
  // text alone would not, since the server renders the article.
  await expect.poll(() => toc.locator('a[href^="#"]').count()).toBeGreaterThan(0);
  await expect(page.locator('nav[data-slot="toc"][aria-hidden="true"]')).toHaveCount(0);

  expect(await page.evaluate(() => window.__mdxHydrationProbe)).toEqual({
    sawContent: true,
    lostContent: false,
  });
});

/**
 * Records every distinct offset the two docs scrollers take once the document is parsed.
 * A scroller positioned before the first paint reports one offset; one the client
 * repositions after hydration reports that jump as a second.
 */
function installScrollJumpProbe() {
  const probe: NonNullable<Window["__scrollJumpProbe"]> = { sidebar: [], main: [] };
  window.__scrollJumpProbe = probe;

  const record = (offsets: number[], scroller: Element | null) => {
    if (!scroller) return;
    if (offsets.at(-1) !== scroller.scrollTop) offsets.push(scroller.scrollTop);
  };

  const sample = () => {
    record(probe.sidebar, document.querySelector('#sidebar-nav [data-slot="scroll-area"]'));
    record(probe.main, document.getElementById("main-content"));
    requestAnimationFrame(sample);
  };
  window.addEventListener("DOMContentLoaded", sample, { once: true });
}

test("centers the sidebar and restores the article before the first paint", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(installScrollJumpProbe);

  // A page far enough down the tree that centering it has to scroll the sidebar.
  await page.goto("/ui/components/select");
  await expect(page.getByRole("heading", { level: 1, name: "Select" })).toBeVisible();
  await expect
    .poll(() => captureActiveSidebarCenterDelta(page))
    .toBeLessThanOrEqual(SIDEBAR_CENTER_TOLERANCE_PX);

  const coldLoad = await page.evaluate(() => window.__scrollJumpProbe);
  expect(coldLoad?.sidebar.length, "sidebar offsets seen while loading").toBe(1);
  expect(coldLoad?.sidebar[0]).toBeGreaterThan(0);
  expect(coldLoad?.main).toEqual([0]);

  await page.evaluate((offset) => {
    document.getElementById("main-content")?.scrollTo({ top: offset });
  }, RESTORED_MAIN_SCROLL_PX);
  // The router persists offsets on a throttled scroll listener; the reload can
  // only restore what already reached session storage.
  await expect
    .poll(() =>
      page.evaluate(
        (offset) =>
          Object.values(sessionStorage).some((entry) => entry.includes(`"scrollY":${offset}`)),
        RESTORED_MAIN_SCROLL_PX,
      ),
    )
    .toBe(true);

  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Select" })).toBeVisible();
  await expect
    .poll(() => captureActiveSidebarCenterDelta(page))
    .toBeLessThanOrEqual(SIDEBAR_CENTER_TOLERANCE_PX);

  const reload = await page.evaluate(() => window.__scrollJumpProbe);
  expect(reload?.sidebar.length, "sidebar offsets seen after reload").toBe(1);
  expect(reload?.main, "article offsets seen after reload").toEqual([RESTORED_MAIN_SCROLL_PX]);
});

test("leaves the sidebar where it is when the active page is already in view", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/ui");

  // The topmost entry is on screen the moment the sidebar paints, so the right amount
  // of scrolling for it is none.
  const topmostPage = await page.evaluate(
    () =>
      document.querySelector<HTMLElement>('#sidebar-nav [data-slot="scroll-area"] [data-value]')
        ?.dataset.value ?? null,
  );
  expect(topmostPage, "topmost sidebar entry").not.toBeNull();

  await page.addInitScript(installScrollJumpProbe);
  await page.goto(topmostPage ?? "/ui");
  await expect(
    page.locator('#sidebar-nav [data-slot="scroll-area"] [aria-current="page"]'),
  ).toBeVisible();

  const probe = await page.evaluate(() => window.__scrollJumpProbe);
  expect(probe?.sidebar, "sidebar offsets for an already-visible page").toEqual([0]);
});

test("opens a document at its #hash anchor without animating there", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(installScrollJumpProbe);

  await page.goto("/ui/components/select#accessibility");
  await expect(page.getByRole("heading", { level: 1, name: "Select" })).toBeVisible();

  const anchorOffset = await page.evaluate(() => {
    const heading = document.getElementById("accessibility");
    const article = document.getElementById("main-content");
    if (!heading || !article) return null;
    return heading.getBoundingClientRect().top - article.getBoundingClientRect().top;
  });
  expect(anchorOffset, "anchor heading offset inside the article").not.toBeNull();
  expect(Math.abs(anchorOffset ?? Number.NaN)).toBeLessThanOrEqual(HASH_ANCHOR_TOLERANCE_PX);

  // An animated scroll to an anchor this far down would paint dozens of intermediate
  // offsets; arriving in one step leaves only the few MAX_HASH_ANCHOR_STEPS covers.
  const probe = await page.evaluate(() => window.__scrollJumpProbe);
  expect(probe?.main.length, "article offsets seen while opening the anchor").toBeLessThanOrEqual(
    MAX_HASH_ANCHOR_STEPS,
  );
  expect(probe?.main.at(-1)).toBeGreaterThan(0);
});

test("replaces stale legal content while a cold legal route loads", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { level: 1, name: "Privacy" })).toBeVisible();
  await page.waitForLoadState("networkidle");

  let releaseTerms: () => void = () => {};
  const termsReleased = new Promise<void>((resolve) => {
    releaseTerms = resolve;
  });
  let termsRequests = 0;
  await page.route("**/*", async (route) => {
    if (!isMdxModuleRequest(route.request().url(), "terms")) {
      await route.continue();
      return;
    }
    termsRequests += 1;
    await termsReleased;
    await route.continue();
  });

  const navigateToTerms = page.getByRole("link", { name: "Terms" }).first().click();
  try {
    await expect.poll(() => termsRequests).toBeGreaterThan(0);
    await expect(page.getByRole("status").filter({ hasText: "Loading legal page" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Privacy" })).toHaveCount(0);
    await expect(page.getByText("[ LEGAL / LOADING ]")).toBeVisible();
  } finally {
    releaseTerms();
  }

  await navigateToTerms;
  await expect(page.getByRole("heading", { level: 1, name: "Terms" })).toBeVisible();
});

test("keeps the ghost TOC at the viewport when a reload restores a deep scroll offset", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });

  // The reload can only restore an offset the router already persisted. (This storage
  // TanStack Router's inline scroll-restoration script restores element offsets.
  await page.goto("/ui/components/select");
  await expect(page.getByRole("navigation", { name: "On this page" })).toBeVisible();
  await page.evaluate((top) => {
    const main = document.getElementById("main-content");
    if (main) main.scrollTop = top;
  }, RESTORED_MAIN_SCROLL_PX);
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem("tsr-scroll-restoration-v1_3") ?? ""))
    .toContain("main-content");

  // Holding the MDX module keeps the reloaded document pre-hydration, so the SSR ghost
  // TOC is the only rail on screen for the whole held window.
  let releaseContent: () => void = () => {};
  const contentReleased = new Promise<void>((resolve) => {
    releaseContent = resolve;
  });
  await page.route("**/*", async (route) => {
    if (!isMdxModuleRequest(route.request().url(), "select")) {
      await route.continue();
      return;
    }
    await contentReleased;
    await route.continue();
  });

  const reload = page.reload();
  try {
    const ghost = page.locator('nav[data-slot="toc"][aria-hidden="true"]');
    await expect(ghost).toBeVisible();
    const probe = await page.evaluate(() => {
      const main = document.getElementById("main-content");
      // Measure a skeleton bar, not the nav: the nav spans the full article column
      // either way, and the sticky wrapper inside it is what is under test.
      const bar = document.querySelector(
        'nav[data-slot="toc"][aria-hidden="true"] [data-slot="skeleton"]',
      );
      const rect = bar?.getBoundingClientRect() ?? null;
      return { scrollTop: main?.scrollTop ?? 0, ghostTop: rect ? rect.top : null };
    });
    expect(probe.scrollTop).toBeGreaterThan(0);
    // Riding the sticky wrapper puts the skeleton inside the viewport rather than at
    // the top of the deeply scrolled document.
    expect(probe.ghostTop).not.toBeNull();
    expect(probe.ghostTop as number).toBeGreaterThanOrEqual(0);
    expect(probe.ghostTop as number).toBeLessThan(1000);
  } finally {
    releaseContent();
  }

  await reload;
  await expect(page.getByRole("navigation", { name: "On this page" })).toBeVisible();
});
