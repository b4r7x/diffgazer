import { isHTMLElement } from "./element-guards.js";

/** Options shared by the imperative focus-restore utilities. */
export interface RestoreFocusOptions {
  /** Passes `preventScroll` to the focus call when restoring focus. */
  preventScroll?: boolean;
}

function getDocument(): Document | null {
  return typeof document === "undefined" ? null : document;
}

/**
 * Returns the current restorable focus target, ignoring body, documentElement,
 * disconnected nodes, and missing DOM.
 */
export function getRestorableFocusTarget(ownerDocument?: Document): HTMLElement | null {
  const doc = ownerDocument ?? getDocument();
  if (!doc) return null;

  const activeElement = doc.activeElement;
  if (!isHTMLElement(activeElement)) return null;
  if (activeElement === doc.body || activeElement === doc.documentElement) return null;
  if (!activeElement.isConnected) return null;

  return activeElement;
}

/**
 * Focuses a connected target and returns whether the document's active element
 * moved to it.
 */
export function restoreFocus(
  target: HTMLElement | null,
  options: RestoreFocusOptions = {},
): boolean {
  if (!target?.isConnected) return false;

  // Some environments reject the FocusOptions argument (older engines, certain
  // jsdom versions). Fall back to a plain focus() so restoration still works;
  // losing preventScroll is acceptable degradation.
  try {
    target.focus({ preventScroll: options.preventScroll });
  } catch {
    target.focus();
  }

  return target.ownerDocument.activeElement === target;
}
