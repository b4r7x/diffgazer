import { useEffect } from "react";
import type { Shortcut } from "../schemas/ui/index.js";
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
 */
export function usePageFooter({
  shortcuts,
  rightShortcuts = EMPTY_SHORTCUTS,
}: PageFooterOptions): void {
  const { setShortcuts, setRightShortcuts } = useFooterActions();

  useEffect(() => {
    setShortcuts(shortcuts);
    setRightShortcuts(rightShortcuts);
  }, [shortcuts, rightShortcuts, setShortcuts, setRightShortcuts]);
}
