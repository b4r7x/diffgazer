import { useEffect } from "react";
import type { Shortcut } from "../schemas/presentation/index.js";
import { useFooterActions } from "./provider.js";
import type { PageFooterOptions } from "./types.js";

const EMPTY_SHORTCUTS: Shortcut[] = [];

/**
 * Publish the current page's keyboard shortcuts to the shared footer state.
 *
 * Reactive in both web and CLI: when `shortcuts` (or `rightShortcuts`) change
 * across renders, the next effect pushes them. The action setters in
 * `FooterProvider` are equality-guarded, so passing the same array contents
 * is a no-op and will not re-render data consumers.
 *
 * The effect deliberately does not reset on unmount: the next page's
 * `usePageFooter` overwrites the state, and resetting would cause a one-frame
 * flicker between routes.
 *
 * A parent's effect runs after its children's, so a page that hands the screen
 * to a guard branch must pass `enabled: false` instead of publishing empty
 * shortcuts, or it overwrites the footer the branch just published.
 */
export function usePageFooter({
  shortcuts,
  rightShortcuts = EMPTY_SHORTCUTS,
  enabled = true,
}: PageFooterOptions): void {
  const { setShortcuts, setRightShortcuts } = useFooterActions();

  useEffect(() => {
    if (!enabled) return;
    setShortcuts(shortcuts);
    setRightShortcuts(rightShortcuts);
  }, [enabled, shortcuts, rightShortcuts, setShortcuts, setRightShortcuts]);
}
