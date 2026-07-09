import { moveHighlight } from "@diffgazer/keys";
import { useState } from "react";

export interface ListNavigationItem {
  id: string;
  disabled: boolean;
}

export interface UseListNavigationOptions {
  items: ListNavigationItem[];
  highlightedId?: string | null;
  onHighlightChange?: (id: string) => void;
  wrap?: boolean;
}

export interface ListNavigation {
  currentHighlightedId: string;
  moveBy: (direction: 1 | -1) => void;
  selectItem: (id: string) => ListNavigationItem | null;
}

export function useListNavigation({
  items,
  highlightedId: controlledHighlightedId = null,
  onHighlightChange,
  wrap = true,
}: UseListNavigationOptions): ListNavigation {
  const selectableItems = items.filter((item) => !item.disabled);
  const [internalHighlightedId, setInternalHighlightedId] = useState<string | null>(null);
  const uncontrolledHighlightedId =
    internalHighlightedId !== null &&
    selectableItems.some((item) => item.id === internalHighlightedId)
      ? internalHighlightedId
      : (selectableItems[0]?.id ?? "");
  const currentHighlightedId = controlledHighlightedId ?? uncontrolledHighlightedId;

  function moveBy(direction: 1 | -1) {
    const result = moveHighlight(items, currentHighlightedId, direction, wrap);
    if (!result) return;
    if (controlledHighlightedId == null) {
      setInternalHighlightedId(result.id);
    }
    onHighlightChange?.(result.id);
  }

  function selectItem(id: string): ListNavigationItem | null {
    return selectableItems.find((item) => item.id === id) ?? null;
  }

  return { currentHighlightedId, moveBy, selectItem };
}
