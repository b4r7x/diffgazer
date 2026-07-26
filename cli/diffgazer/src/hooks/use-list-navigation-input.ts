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
}

/**
 * Binds Ink keyboard input to a `useListNavigation` instance: arrows move the
 * highlight along `orientation`, Enter activates. Components that own extra
 * keys (hotkeys, Escape) register their own `useInput` alongside this one.
 */
export function useListNavigationInput({
  navigation,
  isActive,
  orientation = "vertical",
  onActivate,
  activateOnSpace = false,
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
      if (!onActivate) return;
      if (key.return || (activateOnSpace && input === " ")) {
        const item = navigation.findSelectableItem(navigation.currentHighlightedId);
        if (item) onActivate(item);
      }
    },
    { isActive },
  );
}
