// @vitest-environment jsdom

import { createRequire } from "node:module";
import { dirname } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  MAIN_SCROLL_BOOTSTRAP_CONFIG,
  MAIN_SCROLL_INIT_SCRIPT,
  MAIN_SCROLL_RESTORATION_ID,
  mainScrollBootstrap,
} from "./main-scroll-bootstrap";

const HISTORY_KEY = "history-entry-1";
const SELECTOR = `[data-scroll-restoration-id="${MAIN_SCROLL_RESTORATION_ID}"]`;

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

function renderMain(): HTMLElement {
  const main = document.createElement("main");
  main.dataset.scrollRestorationId = MAIN_SCROLL_RESTORATION_ID;
  document.body.append(main);
  return main;
}

function cacheScroll(key: string, entry: Record<string, { scrollX: number; scrollY: number }>) {
  sessionStorage.setItem(storageKey, JSON.stringify({ [key]: entry }));
}

afterEach(() => {
  document.body.replaceChildren();
  sessionStorage.clear();
  history.replaceState(null, "");
});

describe("mainScrollBootstrap", () => {
  it("reads the same sessionStorage cache the router writes", () => {
    expect(MAIN_SCROLL_BOOTSTRAP_CONFIG.storageKey).toBe(storageKey);
  });

  it("restores the offset the router cached for this history entry", () => {
    const main = renderMain();
    history.replaceState({ __TSR_key: HISTORY_KEY }, "");
    cacheScroll(HISTORY_KEY, { [SELECTOR]: { scrollX: 0, scrollY: 900 } });

    mainScrollBootstrap(MAIN_SCROLL_BOOTSTRAP_CONFIG);

    expect(main.scrollTop).toBe(900);
  });

  it("leaves a first visit at the top", () => {
    const main = renderMain();
    history.replaceState({ __TSR_key: HISTORY_KEY }, "");
    cacheScroll("a-different-entry", { [SELECTOR]: { scrollX: 0, scrollY: 900 } });

    mainScrollBootstrap(MAIN_SCROLL_BOOTSTRAP_CONFIG);

    expect(main.scrollTop).toBe(0);
  });

  it("leaves the scroller alone when the cache is unreadable", () => {
    const main = renderMain();
    history.replaceState({ __TSR_key: HISTORY_KEY }, "");
    sessionStorage.setItem(storageKey, "not json");

    mainScrollBootstrap(MAIN_SCROLL_BOOTSTRAP_CONFIG);

    expect(main.scrollTop).toBe(0);
  });

  it("restores the offset when run as the serialized inline script", () => {
    const main = renderMain();
    history.replaceState({ __TSR_key: HISTORY_KEY }, "");
    cacheScroll(HISTORY_KEY, { [SELECTOR]: { scrollX: 0, scrollY: 900 } });

    // The inline script is what actually ships; evaluating it proves the
    // serialized body stays self-contained (no imports, no module constants).
    new Function(MAIN_SCROLL_INIT_SCRIPT)();

    expect(main.scrollTop).toBe(900);
  });
});
