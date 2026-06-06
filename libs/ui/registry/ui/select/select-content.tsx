"use client";

import { Children, isValidElement, type KeyboardEvent, type ReactNode, type Ref, useCallback, useLayoutEffect, useRef } from "react";
import type { FloatingAlign, FloatingSide } from "@/hooks/use-floating-position";
import { useNavigation } from "@/hooks/use-navigation";
import { composeRefs } from "@/lib/compose-refs";
import { matchesSearch } from "@/lib/search";
import { cn } from "@/lib/utils";
import { FloatingPanel } from "../floating-panel";
import { SearchableContent, type SearchableListboxProps } from "./searchable-content";
import type { SelectOptionMetadata } from "./select-context";
import { useSelectContext } from "./select-context";
import { SelectSearch } from "./select-search";
import { isActiveOptionVisible, toOptionId } from "./selection";
import { useSelectTypeahead } from "./use-typeahead";
import { getVisibleEnabledOptions } from "./visible-options";

export interface SelectContentProps {
  children: ReactNode;
  className?: string;
  onKeyDown?: (event: KeyboardEvent) => void;
  side?: FloatingSide;
  align?: FloatingAlign;
  sideOffset?: number;
  collisionPadding?: number;
  ref?: Ref<HTMLDivElement>;
}

const SEARCH_INPUT_NAV_KEYS = new Set(["ArrowUp", "ArrowDown", "Enter"]);

export function SelectContent({
  children,
  className,
  onKeyDown,
  side = "bottom",
  align = "start",
  // Tighter than FloatingPanel's default (6) so the dropdown reads as visually
  // attached to the trigger. Override per-instance via the prop.
  sideOffset = 4,
  collisionPadding = 8,
  ref,
}: SelectContentProps) {
  const {
    open,
    multiple,
    variant,
    value,
    highlighted,
    setHighlighted,
    onOpenChange,
    selectItem,
    listboxId,
    triggerId,
    searchInputRef,
    triggerRef,
    contentRef: selectContentRef,
    options,
    searchQuery,
    required,
    ariaInvalid,
  } = useSelectContext("SelectContent");
  const containerRef = useRef<HTMLDivElement>(null);
  const isDropdown = variant !== "card";
  const hasSearch = containsSelectSearchElement(children);

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

  const handleTypeahead = useSelectTypeahead({ options, searchQuery, highlighted, setHighlighted });

  function moveSearchHighlight(direction: 1 | -1): void {
    const visibleOptions = getVisibleEnabledOptions(options, searchQuery);
    if (visibleOptions.length === 0) return;

    const currentIndex = highlighted === null ? -1 : visibleOptions.indexOf(highlighted);
    const nextIndex =
      currentIndex < 0
        ? direction > 0 ? 0 : visibleOptions.length - 1
        : (currentIndex + direction + visibleOptions.length) % visibleOptions.length;
    const nextOption = visibleOptions[nextIndex];
    if (nextOption === undefined) return;
    setHighlighted(nextOption);
  }

  function handleSearchInputNavigation(e: KeyboardEvent): void {
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

  const initHighlight = useCallback(() => {
    if (highlighted !== null) return;
    const selectedValues = Array.isArray(value) ? value : value === null ? [] : [value];
    const firstSelected = selectedValues[0];
    if (firstSelected !== undefined && !options.get(firstSelected)?.disabled) {
      setHighlighted(firstSelected);
      return;
    }
    for (const [itemValue, option] of options) {
      if (!option.disabled) {
        setHighlighted(itemValue);
        return;
      }
    }
  }, [highlighted, options, setHighlighted, value]);

  useLayoutEffect(() => {
    if (!open) return;
    if (!searchInputRef.current) {
      containerRef.current?.focus();
    }
    initHighlight();
  }, [initHighlight, open, searchInputRef]);

  const handleKeyDown = (e: KeyboardEvent) => {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;

    if (e.key === "Escape") {
      e.preventDefault();
      onOpenChange(false);
      triggerRef.current?.focus();
      return;
    }

    if (e.key === "Tab") {
      if (highlighted !== null && !multiple) selectItem(highlighted);
      onOpenChange(false);
      return;
    }

    const isTyping = e.target === searchInputRef.current;
    if (isTyping) {
      handleSearchInputNavigation(e);
    } else {
      navKeyDown(e);
      if (!e.ctrlKey && !e.metaKey && !e.altKey) handleTypeahead(e.key);
    }
  };

  const activeDescendant = isActiveOptionVisible(options, highlighted, searchQuery, matchesSearch)
    ? toOptionId(listboxId, highlighted)
    : undefined;
  const listboxPropsBase = {
    id: listboxId,
    role: "listbox" as const,
    tabIndex: -1,
    "aria-multiselectable": multiple || undefined,
    "aria-activedescendant": !hasSearch ? activeDescendant : undefined,
    "aria-labelledby": triggerId,
    "aria-required": required,
    "aria-invalid": ariaInvalid,
  } satisfies SearchableListboxProps;
  const listboxProps = hasSearch
    ? listboxPropsBase
    : { ...listboxPropsBase, onKeyDown: handleKeyDown };
  const contentBody = hasSearch
    ? <SearchableContent listboxProps={listboxProps} ref={containerRef}>{children}</SearchableContent>
    : children;

  if (!isDropdown) {
    return (
      <div
        {...(hasSearch ? { onKeyDown: handleKeyDown } : listboxProps)}
        ref={hasSearch ? composeRefs(selectContentRef, ref) : composeRefs(containerRef, selectContentRef, ref)}
        hidden={!open}
        className={cn("w-full overflow-hidden p-1 space-y-0.5 outline-none", className)}
      >
        {contentBody}
        {searchQuery && <MatchCount options={options} searchQuery={searchQuery} />}
      </div>
    );
  }

  return (
    <FloatingPanel
      {...(hasSearch ? { onKeyDown: handleKeyDown } : listboxProps)}
      open={open}
      triggerRef={triggerRef}
      side={side}
      align={align}
      sideOffset={sideOffset}
      collisionPadding={collisionPadding}
      avoidCollisions
      matchTriggerWidth
      ref={hasSearch ? composeRefs(selectContentRef, ref) : composeRefs(containerRef, selectContentRef, ref)}
      className={cn(
        "border border-border bg-background shadow-2xl rounded-sm overflow-hidden outline-none",
        className,
      )}
      style={{ width: "var(--ui-floating-trigger-width)" }}
    >
      {contentBody}
      {searchQuery && <MatchCount options={options} searchQuery={searchQuery} />}
    </FloatingPanel>
  );
}

function containsSelectSearchElement(children: ReactNode): boolean {
  return Children.toArray(children).some((child) => {
    if (isSelectSearchElement(child)) return true;
    if (!isValidElement<{ children?: ReactNode }>(child)) return false;
    return containsSelectSearchElement(child.props.children);
  });
}

function isSelectSearchElement(child: ReactNode): boolean {
  return isValidElement(child) && child.type === SelectSearch;
}

function MatchCount({ options, searchQuery }: { options: ReadonlyMap<string, SelectOptionMetadata>; searchQuery: string }) {
  let count = 0;
  for (const option of options.values()) {
    if (matchesSearch(option.label, searchQuery)) count++;
  }
  return (
    // biome-ignore lint/a11y/useSemanticElements: role="status" is the sr-only results-count live region; <output> carries form-association semantics that do not fit here.
    <div role="status" aria-live="polite" className="sr-only">
      {count} results
    </div>
  );
}
