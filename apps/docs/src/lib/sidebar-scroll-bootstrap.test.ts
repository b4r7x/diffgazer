import { createRequire } from "node:module";
import { dirname } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  consumePrePaintPositioning,
  SIDEBAR_PRE_PAINT_POSITIONED_ATTRIBUTE,
  SIDEBAR_SCROLL_BOOTSTRAP_CONFIG,
  SIDEBAR_SCROLL_INIT_SCRIPT,
  SIDEBAR_SCROLL_RESTORATION_ID,
  sidebarScrollBootstrap,
} from "./sidebar-scroll-bootstrap";

const HISTORY_KEY = "history-entry-1";

/**
 * The router's own scroll cache key, read from the `@tanstack/router-core` copy that
 * `@tanstack/react-router` resolves. The app cannot import that package (a second
 * router instance breaks SSR dehydration), so the mirrored constant is pinned here.
 */
function routerScrollStorageKey(): string {
  const require = createRequire(import.meta.url);
  const routerCore = require(
    require.resolve("@tanstack/router-core", {
      paths: [dirname(require.resolve("@tanstack/react-router"))],
    }),
  );
  return routerCore.storageKey;
}

const storageKey = routerScrollStorageKey();

function rect({ top, height }: { top: number; height: number }): DOMRect {
  return {
    top,
    height,
    bottom: top + height,
    left: 0,
    right: 0,
    width: 0,
    x: 0,
    y: top,
    toJSON: () => ({}),
  };
}

// The scroll area spans 100..500, inset to 108..484 by the shell's scroll-padding
// (`scroll-pt-2 scroll-pb-4` in tree-sidebar-shell). An active page at 200 is one
// the reader can already see; one at 700 sits below the fold and has to be
// scrolled to.
const VISIBLE_PAGE_TOP = 200;
const OFFSCREEN_PAGE_TOP = 700;

interface SidebarFixture {
  activePage?: boolean;
  activePageTop?: number;
}

function renderSidebar({
  activePage = true,
  activePageTop = OFFSCREEN_PAGE_TOP,
}: SidebarFixture = {}): {
  scrollArea: HTMLElement;
  page: HTMLElement;
} {
  const sidebar = document.createElement("aside");
  sidebar.id = "sidebar-nav";
  const scrollArea = document.createElement("div");
  scrollArea.dataset.slot = "scroll-area";
  scrollArea.dataset.scrollRestorationId = SIDEBAR_SCROLL_RESTORATION_ID;
  const page = document.createElement("a");
  page.dataset.diffgazerNavigationItem = "button";
  if (activePage) page.setAttribute("aria-current", "page");
  scrollArea.append(page);
  sidebar.append(scrollArea);
  document.body.append(sidebar);

  scrollArea.style.scrollPaddingTop = "8px";
  scrollArea.style.scrollPaddingBottom = "16px";
  Object.defineProperties(scrollArea, {
    clientHeight: { configurable: true, value: 400 },
    scrollHeight: { configurable: true, value: 1_200 },
  });
  scrollArea.getBoundingClientRect = () => rect({ top: 100, height: 400 });
  page.getBoundingClientRect = () => rect({ top: activePageTop, height: 40 });

  return { scrollArea, page };
}

function cacheScroll(key: string, entry: Record<string, { scrollX: number; scrollY: number }>) {
  sessionStorage.setItem(storageKey, JSON.stringify({ [key]: entry }));
}

function cachedEntry(key: string): Record<string, unknown> | undefined {
  return JSON.parse(sessionStorage.getItem(storageKey) ?? "{}")[key];
}

afterEach(() => {
  document.body.replaceChildren();
  document.documentElement.removeAttribute(SIDEBAR_PRE_PAINT_POSITIONED_ATTRIBUTE);
  sessionStorage.clear();
  history.replaceState(null, "");
});

describe("sidebarScrollBootstrap", () => {
  it("centers an active page that sits outside its own scroll area", () => {
    const { scrollArea } = renderSidebar();

    sidebarScrollBootstrap(SIDEBAR_SCROLL_BOOTSTRAP_CONFIG);

    expect(scrollArea.scrollTop).toBe(420);
  });

  it("leaves an active page the reader can already see where it is", () => {
    const { scrollArea } = renderSidebar({ activePageTop: VISIBLE_PAGE_TOP });

    sidebarScrollBootstrap(SIDEBAR_SCROLL_BOOTSTRAP_CONFIG);

    expect(scrollArea.scrollTop).toBe(0);
  });

  it("centers an active page parked inside the bottom scroll-padding band", () => {
    // 455..495 fits the raw scrollport but crosses the 484 inset bottom; the
    // hydration `nearest` scroll would nudge it after paint if left alone here.
    const { scrollArea } = renderSidebar({ activePageTop: 455 });

    sidebarScrollBootstrap(SIDEBAR_SCROLL_BOOTSTRAP_CONFIG);

    expect(scrollArea.scrollTop).toBe(175);
  });

  it("centers an active page parked inside the top scroll-padding band", () => {
    // 104..144 fits the raw scrollport but crosses the 108 inset top.
    const { scrollArea } = renderSidebar({ activePageTop: 104 });
    scrollArea.scrollTop = 300;

    sidebarScrollBootstrap(SIDEBAR_SCROLL_BOOTSTRAP_CONFIG);

    expect(scrollArea.scrollTop).toBe(124);
  });

  it("reports a settled sidebar even when nothing had to move", () => {
    renderSidebar({ activePageTop: VISIBLE_PAGE_TOP });

    sidebarScrollBootstrap(SIDEBAR_SCROLL_BOOTSTRAP_CONFIG);

    expect(consumePrePaintPositioning()).toBe(true);
  });

  it("leaves the scroll position untouched without an active docs page", () => {
    const { scrollArea } = renderSidebar({ activePage: false });

    sidebarScrollBootstrap(SIDEBAR_SCROLL_BOOTSTRAP_CONFIG);

    expect(scrollArea.scrollTop).toBe(0);
  });

  it("centers the active page when run as the serialized inline script", () => {
    const { scrollArea } = renderSidebar();

    // The inline script is what actually ships; evaluating it proves the
    // serialized body stays self-contained (no imports, no module constants).
    new Function(SIDEBAR_SCROLL_INIT_SCRIPT)();

    expect(scrollArea.scrollTop).toBe(420);
  });
});

describe("sidebarScrollBootstrap router cache eviction", () => {
  it("writes to the same sessionStorage cache the router reads", () => {
    expect(SIDEBAR_SCROLL_BOOTSTRAP_CONFIG.storageKey).toBe(storageKey);
  });

  it("drops the sidebar offset the router would otherwise restore after hydration", () => {
    renderSidebar();
    history.replaceState({ __TSR_key: HISTORY_KEY }, "");
    cacheScroll(HISTORY_KEY, {
      [SIDEBAR_SCROLL_BOOTSTRAP_CONFIG.scrollAreaSelector]: { scrollX: 0, scrollY: 40 },
      '[data-scroll-restoration-id="main-content"]': { scrollX: 0, scrollY: 900 },
    });

    sidebarScrollBootstrap(SIDEBAR_SCROLL_BOOTSTRAP_CONFIG);

    expect(cachedEntry(HISTORY_KEY)).toEqual({
      '[data-scroll-restoration-id="main-content"]': { scrollX: 0, scrollY: 900 },
    });
  });

  it("still settles the sidebar when the cache is unreadable", () => {
    const { scrollArea } = renderSidebar();
    history.replaceState({ __TSR_key: HISTORY_KEY }, "");
    sessionStorage.setItem(storageKey, "not json");

    sidebarScrollBootstrap(SIDEBAR_SCROLL_BOOTSTRAP_CONFIG);

    expect(scrollArea.scrollTop).toBe(420);
  });
});

describe("consumePrePaintPositioning", () => {
  it("reports a positioned sidebar once, then reports it as unpositioned", () => {
    renderSidebar();
    sidebarScrollBootstrap(SIDEBAR_SCROLL_BOOTSTRAP_CONFIG);

    expect(consumePrePaintPositioning()).toBe(true);
    expect(consumePrePaintPositioning()).toBe(false);
  });

  it("reports a sidebar the script never positioned as unpositioned", () => {
    renderSidebar({ activePage: false });
    sidebarScrollBootstrap(SIDEBAR_SCROLL_BOOTSTRAP_CONFIG);

    expect(consumePrePaintPositioning()).toBe(false);
  });

  it("keeps the marker off the scroll area so it never reaches hydration diffing", () => {
    const { scrollArea } = renderSidebar();

    sidebarScrollBootstrap(SIDEBAR_SCROLL_BOOTSTRAP_CONFIG);

    expect(scrollArea.hasAttribute(SIDEBAR_PRE_PAINT_POSITIONED_ATTRIBUTE)).toBe(false);
    expect(document.documentElement.hasAttribute(SIDEBAR_PRE_PAINT_POSITIONED_ATTRIBUTE)).toBe(
      true,
    );
  });
});
