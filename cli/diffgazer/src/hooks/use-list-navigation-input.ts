import { useInput } from "ink";
import type { ListNavigation, ListNavigationItem } from "./use-list-navigation";

export interface UseListNavigationInputOptions {
  navigation: ListNavigation;
  isActive: boolean;
  orientation?: "vertical" | "horizontal";
  /** Receives the highlighted item, or is skipped when nothing selectable is highlighted. */
  onActivate?: (item: ListNavigationItem) => void;
  /** Toggle-style controls activate on Space as well as Enter; menus and lists do not. */
  activateOnSpace?: boolean;
  /** Owners that bind Enter themselves (confirm-and-close overlays) opt out of Enter activation. */
  activateOnReturn?: boolean;
}

/**
 * Binds Ink keyboard input to a `useListNavigation` instance: arrows move the
 * highlight along `orientation`, Enter activates. Vertical lists also take the
 * vim keys the shared help table promises for lists (`j`/`k`); horizontal ones
 * stay arrows-only. Components that own extra keys (hotkeys, Escape) register
 * their own `useInput` alongside this one.
 */
export function useListNavigationInput({
  navigation,
  isActive,
  orientation = "vertical",
  onActivate,
  activateOnSpace = false,
  activateOnReturn = true,
}: UseListNavigationInputOptions): void {
  const isVertical = orientation === "vertical";

  useInput(
    (input, key) => {
      if (isVertical ? key.upArrow : key.leftArrow) {
        navigation.moveBy(-1);
        return;
      }
      if (isVertical ? key.downArrow : key.rightArrow) {
        navigation.moveBy(1);
        return;
      }
      if (isVertical && input === "k") {
        navigation.moveBy(-1);
        return;
      }
      if (isVertical && input === "j") {
        navigation.moveBy(1);
        return;
      }
      if (!onActivate) return;
      if ((activateOnReturn && key.return) || (activateOnSpace && input === " ")) {
        const item = navigation.findSelectableItem(navigation.currentHighlightedId);
        if (item) onActivate(item);
      }
    },
    { isActive },
  );
}
