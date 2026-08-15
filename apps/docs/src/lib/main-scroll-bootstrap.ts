/**
 * The sessionStorage key TanStack Router keeps its scroll cache under. It is only
 * reachable through `@tanstack/router-core`, and importing that package directly
 * gives the SSR build a second router instance, so the value is mirrored here and
 * pinned by main-scroll-bootstrap.test.
 */
import { MAIN_SCROLL_RESTORATION_ID } from "./main-scroll-restoration";

const SCROLL_RESTORATION_STORAGE_KEY = "tsr-scroll-restoration-v1_3";
const MAIN_SCROLL_SELECTOR = `[data-scroll-restoration-id="${MAIN_SCROLL_RESTORATION_ID}"]`;

export interface MainScrollBootstrapConfig {
  storageKey: string;
  elementSelector: string;
}

/**
 * Reapplies the offset TanStack Router cached for this history entry. The router
 * restores it too, but only after hydration, so a reloaded page paints at the top
 * and jumps a few frames later.
 *
 * Serialized with `Function.prototype.toString` and injected inline, so it must stay
 * self-contained: every value arrives through `config`, with no module constants.
 */
export function mainScrollBootstrap(config: MainScrollBootstrapConfig): void {
  try {
    const historyKey = window.history.state?.__TSR_key;
    const cache = JSON.parse(sessionStorage.getItem(config.storageKey) ?? "{}");
    const entry = historyKey ? cache[historyKey]?.[config.elementSelector] : undefined;
    if (!entry) return;

    const element = document.querySelector(config.elementSelector);
    if (!element) return;

    element.scrollLeft = entry.scrollX;
    element.scrollTop = entry.scrollY;
  } catch {
    // Unreadable storage or malformed cache leaves the router's post-hydration restore.
  }
}

export const MAIN_SCROLL_BOOTSTRAP_CONFIG: MainScrollBootstrapConfig = {
  storageKey: SCROLL_RESTORATION_STORAGE_KEY,
  elementSelector: MAIN_SCROLL_SELECTOR,
};

/** {@link mainScrollBootstrap} serialized for parser-blocking inline scripts. */
export const MAIN_SCROLL_INIT_SCRIPT = `(${mainScrollBootstrap.toString()})(${JSON.stringify(MAIN_SCROLL_BOOTSTRAP_CONFIG)});`;
