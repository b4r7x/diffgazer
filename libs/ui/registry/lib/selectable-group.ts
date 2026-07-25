"use client";

import { useEffect, useRef } from "react";
import {
  getEnabledSelectableCollectionItems,
  resolveSelectableCollectionItem,
  type SelectableCollectionItem,
} from "./selectable-collection";

interface SelectableGroupAutoFocusOptions {
  /** Whether the group should claim focus once it becomes active. */
  autoFocus: boolean;
  /** Whether built-in arrow-key navigation is enabled. */
  keyboardNavigation: boolean;
  /** Whether the group is disabled, directly or through a fieldset. */
  disabled: boolean;
  /** Registered items in DOM order. */
  items: SelectableCollectionItem[];
  /** Currently highlighted item value, preferred over the selection. */
  highlightedValue: string | null;
  /** Selected value(s); an array for multi-select groups, tried in order. */
  selectedValue: string | string[] | undefined;
  /** Called with the value of the item that received focus. */
  setHighlightedValue: (value: string | null) => void;
}

/**
 * Focuses the highlighted, selected, or first enabled item the first time the group
 * becomes active, and re-arms once the group stops being auto-focusable.
 */
export function useSelectableGroupAutoFocus({
  autoFocus,
  keyboardNavigation,
  disabled,
  items,
  highlightedValue,
  selectedValue,
  setHighlightedValue,
}: SelectableGroupAutoFocusOptions): void {
  const hasAutoFocusedRef = useRef(false);

  useEffect(() => {
    if (!autoFocus || !keyboardNavigation || disabled) {
      hasAutoFocusedRef.current = false;
      return;
    }
    if (hasAutoFocusedRef.current) return;

    const activeItems = getEnabledSelectableCollectionItems(items, disabled);
    const preferredValues = Array.isArray(selectedValue) ? selectedValue : [selectedValue];
    const target = resolveSelectableCollectionItem(
      activeItems,
      highlightedValue,
      ...preferredValues,
    );
    if (!target?.element) return;

    target.element.focus();
    setHighlightedValue(target.value);
    hasAutoFocusedRef.current = true;
  }, [
    autoFocus,
    keyboardNavigation,
    disabled,
    items,
    highlightedValue,
    selectedValue,
    setHighlightedValue,
  ]);
}
