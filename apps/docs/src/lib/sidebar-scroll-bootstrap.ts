import { NAVIGATION_ITEM_ATTRIBUTE } from "@diffgazer/keys";

/**
 * The sessionStorage key TanStack Router keeps its scroll cache under. It is only
 * reachable through `@tanstack/router-core`, and importing that package directly
 * gives the SSR build a second router instance (dehydration then throws), so the
 * value is mirrored here and pinned to the router's own by
 * sidebar-scroll-bootstrap.test.
 */
const SCROLL_RESTORATION_STORAGE_KEY = "tsr-scroll-restoration-v1_3";

/**
 * The router records this scroller either way; naming it replaces the generated
 * `nth-child` cache key with a selector the pre-paint script below can evict.
 */
export const SIDEBAR_SCROLL_RESTORATION_ID = "docs-sidebar";

const SIDEBAR_SCROLL_SELECTOR = `[data-scroll-restoration-id="${SIDEBAR_SCROLL_RESTORATION_ID}"]`;

/**
 * Means "the initial position is decided", including when the decision was to leave an
 * already-visible item alone — re-centering after hydration would nudge the page by the
 * chrome row the pre-paint measurement was off by, which is the jump this exists to remove.
 *
 * It lands on documentElement, not the scroll area, because React renders the scroll area
 * and React 19 will not patch up a server-only attribute mismatch. documentElement is
 * already marked `suppressHydrationWarning` in routes/__root.tsx for pre-paint stamping.
 */
export const SIDEBAR_PRE_PAINT_POSITIONED_ATTRIBUTE = "data-initial-page-positioned";

export interface SidebarScrollBootstrapConfig {
  activePageSelector: string;
  scrollAreaSelector: string;
  storageKey: string;
  positionedAttribute: string;
}

/**
 * Settles where the sidebar sits before the first paint, and drops it from the router's
 * scroll cache: this scroller's offset always follows the active page, so the offset the
 * router would restore after hydration is never the right answer for it.
 *
 * Serialized with `Function.prototype.toString` and injected inline, so it must stay
 * self-contained: every value arrives through `config`, no imports or module constants.
 */
export function sidebarScrollBootstrap(config: SidebarScrollBootstrapConfig): void {
  try {
    const historyKey = window.history.state?.__TSR_key;
    const cache = JSON.parse(sessionStorage.getItem(config.storageKey) ?? "{}");
    if (historyKey && cache[historyKey]?.[config.scrollAreaSelector]) {
      delete cache[historyKey][config.scrollAreaSelector];
      sessionStorage.setItem(config.storageKey, JSON.stringify(cache));
    }
  } catch {
    // Unreadable storage or a malformed cache leaves the router nothing to restore
    // from either, which is what this eviction wanted.
  }

  const activePage = document.querySelector<HTMLElement>(config.activePageSelector);
  const scrollArea = activePage?.closest<HTMLElement>(config.scrollAreaSelector);
  if (!activePage || !scrollArea) return;

  const activeRect = activePage.getBoundingClientRect();
  const scrollAreaRect = scrollArea.getBoundingClientRect();
  const isActivePageVisible =
    activeRect.top >= scrollAreaRect.top && activeRect.bottom <= scrollAreaRect.bottom;

  if (!isActivePageVisible) {
    const activeOffset = activeRect.top - scrollAreaRect.top + scrollArea.scrollTop;
    const centeredTop = activeOffset - (scrollArea.clientHeight - activeRect.height) / 2;
    const maximumTop = Math.max(0, scrollArea.scrollHeight - scrollArea.clientHeight);
    scrollArea.scrollTop = Math.min(Math.max(0, centeredTop), maximumTop);
  }

  document.documentElement.setAttribute(config.positionedAttribute, "");
}

/** Clears the marker as it reads it, so a later mount centers normally. */
export function consumePrePaintPositioning(): boolean {
  const root = document.documentElement;
  if (!root.hasAttribute(SIDEBAR_PRE_PAINT_POSITIONED_ATTRIBUTE)) return false;

  root.removeAttribute(SIDEBAR_PRE_PAINT_POSITIONED_ATTRIBUTE);
  return true;
}

export const SIDEBAR_SCROLL_BOOTSTRAP_CONFIG: SidebarScrollBootstrapConfig = {
  activePageSelector: `#sidebar-nav ${SIDEBAR_SCROLL_SELECTOR} [aria-current="page"][${NAVIGATION_ITEM_ATTRIBUTE}]`,
  scrollAreaSelector: SIDEBAR_SCROLL_SELECTOR,
  storageKey: SCROLL_RESTORATION_STORAGE_KEY,
  positionedAttribute: SIDEBAR_PRE_PAINT_POSITIONED_ATTRIBUTE,
};

/** {@link sidebarScrollBootstrap} serialized for the inline script in layout/sidebar.tsx. */
export const SIDEBAR_SCROLL_INIT_SCRIPT = `(${sidebarScrollBootstrap.toString()})(${JSON.stringify(SIDEBAR_SCROLL_BOOTSTRAP_CONFIG)});`;
