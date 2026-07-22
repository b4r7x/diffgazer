"use client";

import {
  type KeyboardEvent,
  type RefObject,
  useCallback,
  useEffectEvent,
  useLayoutEffect,
  useRef,
} from "react";
import { useNavigation } from "@/hooks/use-navigation";
import { useEscapeKey } from "@/hooks/use-outside-click";
import { matchesSearch } from "@/lib/search";
import { useSelectContext } from "./select-context";
import { isActiveOptionVisible, toOptionId } from "./selection";
import { useSelectTypeahead } from "./use-typeahead";
import { getVisibleEnabledOptions } from "./visible-options";

const SEARCH_INPUT_NAV_KEYS = new Set(["ArrowUp", "ArrowDown", "Enter"]);

function isComposingKeyEvent(event: { isComposing?: boolean; keyCode?: number }): boolean {
  return event.isComposing === true || event.keyCode === 229;
}

interface UseSelectContentNavigationOptions {
  containerRef: RefObject<HTMLDivElement | null>;
  isDropdown: boolean;
  onKeyDown?: (event: KeyboardEvent) => void;
}

/** Listbox keyboard navigation, typeahead, scrolling, and open initialization for SelectContent. */
export function useSelectContentNavigation({
  containerRef,
  isDropdown,
  onKeyDown,
}: UseSelectContentNavigationOptions) {
  const {
    open,
    multiple,
    value,
    highlighted,
    setHighlighted,
    onOpenChange,
    selectItem,
    listboxId,
    searchInputRef,
    triggerRef,
    contentRef: selectContentRef,
    options,
    searchQuery,
  } = useSelectContext("useSelectContentNavigation");

  const { onKeyDown: navKeyDown } = useNavigation({
    containerRef,
    role: "option",
    wrap: true,
    highlighted,
    onHighlightChange: setHighlighted,
    onSelect: selectItem,
    enabled: open,
    scopeToContainer: true,
  });

  // Non-arrow highlight paths (typeahead, searchable arrows) must scroll the
  // active descendant into view (WCAG 2.4.11); useNavigation scrolls the arrow path.
  const scrollOptionIntoView = useCallback(
    (optionValue: string) => {
      const node = containerRef.current?.ownerDocument.getElementById(
        toOptionId(listboxId, optionValue),
      );
      node?.scrollIntoView?.({ block: "nearest" });
    },
    [containerRef, listboxId],
  );

  const setHighlightedAndScroll = useCallback(
    (optionValue: string) => {
      setHighlighted(optionValue);
      scrollOptionIntoView(optionValue);
    },
    [setHighlighted, scrollOptionIntoView],
  );

  const handleTypeahead = useSelectTypeahead({
    open,
    options,
    searchQuery,
    highlighted,
    setHighlighted: setHighlightedAndScroll,
  });

  function moveSearchHighlight(direction: 1 | -1): void {
    const visibleOptions = getVisibleEnabledOptions(options, searchQuery);
    if (visibleOptions.length === 0) return;

    const currentIndex = highlighted === null ? -1 : visibleOptions.indexOf(highlighted);
    let nextIndex = (currentIndex + direction + visibleOptions.length) % visibleOptions.length;
    if (currentIndex < 0) {
      nextIndex = direction > 0 ? 0 : visibleOptions.length - 1;
    }
    const nextOption = visibleOptions[nextIndex];
    if (nextOption === undefined) return;
    setHighlightedAndScroll(nextOption);
  }

  function handleSearchInputNavigation(e: KeyboardEvent): void {
    if (isComposingKeyEvent(e)) return;
    if (!SEARCH_INPUT_NAV_KEYS.has(e.key)) return;

    if (e.key === "Enter") {
      e.preventDefault();
      if (isActiveOptionVisible(options, highlighted, searchQuery, matchesSearch)) {
        selectItem(highlighted);
      }
      return;
    }

    e.preventDefault();
    moveSearchHighlight(e.key === "ArrowDown" ? 1 : -1);
  }

  const initializeHighlight = () => {
    const isAvailable = (optionValue: string) => {
      const option = options.get(optionValue);
      return option !== undefined && !option.disabled && matchesSearch(option.label, searchQuery);
    };
    if (highlighted !== null && isAvailable(highlighted)) {
      scrollOptionIntoView(highlighted);
      return true;
    }
    let selectedValues: string[] = [];
    if (Array.isArray(value)) {
      selectedValues = value;
    } else if (value !== null) {
      selectedValues = [value];
    }
    const firstSelected = selectedValues[0];
    if (firstSelected !== undefined && isAvailable(firstSelected)) {
      setHighlightedAndScroll(firstSelected);
      return true;
    }
    for (const [itemValue, option] of options) {
      if (!option.disabled && matchesSearch(option.label, searchQuery)) {
        setHighlightedAndScroll(itemValue);
        return true;
      }
    }
    return false;
  };

  const focusOpenContent = () => {
    const focusTarget = searchInputRef.current ?? containerRef.current;
    if (!focusTarget) return false;

    const { activeElement, body } = focusTarget.ownerDocument;
    if (activeElement === null || activeElement === body || activeElement === triggerRef.current) {
      focusTarget.focus();
    }
    return true;
  };

  // Read current option state without re-running initialization on unrelated renders.
  const runOpenInit = useEffectEvent(() => {
    focusOpenContent();
    return initializeHighlight();
  });

  const inlineHighlightInitializedRef = useRef(false);
  useLayoutEffect(() => {
    if (!open || isDropdown) {
      inlineHighlightInitializedRef.current = false;
      return;
    }
    if (!inlineHighlightInitializedRef.current && options.size > 0) {
      inlineHighlightInitializedRef.current = runOpenInit();
    }
  }, [isDropdown, open, options]);

  useEscapeKey(
    (event) => {
      // Consume the key so an ancestor native <dialog> does not treat the same
      // press as cancel and close together with the dropdown.
      event.preventDefault();
      onOpenChange(false);
      triggerRef.current?.focus();
    },
    open && isDropdown,
    {
      ref: selectContentRef,
      contains: (target) =>
        target !== null && (selectContentRef.current?.contains(target) ?? false),
    },
  );

  const handleKeyDown = (e: KeyboardEvent) => {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;

    if (e.key === "Escape") {
      if (!isDropdown) return;
      e.preventDefault();
      onOpenChange(false);
      triggerRef.current?.focus();
      return;
    }

    if (e.key === "Tab") {
      if (!isDropdown) return;
      if (highlighted !== null && !multiple) selectItem(highlighted);
      onOpenChange(false);
      // Restore focus synchronously for modes that skip the single-select commit,
      // or Tab would leave focus in the portaled panel and drop to <body>.
      triggerRef.current?.focus();
      return;
    }

    const isTyping = e.target === searchInputRef.current;
    if (isTyping) {
      handleSearchInputNavigation(e);
      return;
    }

    const isModified = e.ctrlKey || e.metaKey || e.altKey;
    // Run typeahead before navKeyDown for Space so an in-progress query ("new y")
    // extends the buffer instead of selecting.
    if (e.key === " " && !isModified && handleTypeahead(e.key)) return;
    navKeyDown(e);
    if (e.key !== " " && !isModified) handleTypeahead(e.key);
  };

  const activeDescendant = isActiveOptionVisible(options, highlighted, searchQuery, matchesSearch)
    ? toOptionId(listboxId, highlighted)
    : undefined;

  return {
    handleKeyDown,
    activeDescendant,
    focusOpenContent,
    initializeHighlight,
  };
}
