import type { MouseEvent } from "react";

/** A new-tab/background click (middle button or modifier) should not dismiss the sidebar. */
export function isPrimaryNavigationClick(event: MouseEvent): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}
