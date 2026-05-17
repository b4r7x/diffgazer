"use client";

import { Children, Fragment, cloneElement, isValidElement, useCallback, useLayoutEffect, useRef, useState, type AriaAttributes, type ReactNode, type KeyboardEvent, type Ref } from "react";
import { useNavigation } from "@/hooks/use-navigation";
import { usePresence } from "@/hooks/use-presence";
import { useTypeaheadBuffer } from "@/hooks/use-typeahead-buffer";
import { useFloatingPosition, type FloatingSide, type FloatingAlign } from "@/hooks/use-floating-position";
import { composeRefs } from "@/lib/compose-refs";
import { typeaheadSearch } from "@/lib/typeahead";
import { cn } from "@/lib/utils";
import { Portal } from "../shared/portal";
import { useSelectContext } from "./select-context";
import { matchesSearch } from "@/lib/search";
import { isActiveOptionVisible, toOptionId } from "./select-utils";
import { SelectSearch } from "./select-search";
import { SelectEmpty } from "./select-empty";
import type { SelectOptionMetadata } from "./select-context";

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
type ListboxProps = {
  id: string;
  role: "listbox";
  tabIndex: -1;
  "aria-multiselectable": boolean | undefined;
  "aria-activedescendant": string | undefined;
  "aria-labelledby": string;
  "aria-required": boolean | undefined;
  "aria-invalid": AriaAttributes["aria-invalid"] | undefined;
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
};

type SearchableListboxProps = Omit<ListboxProps, "onKeyDown">;

export function SelectContent({
  children,
  className,
  onKeyDown,
  side = "bottom",
  align = "start",
  sideOffset = 0,
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
  const [triggerWidth, setTriggerWidth] = useState<number | undefined>(undefined);
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

  const readTypeaheadQuery = useTypeaheadBuffer();

  function handleTypeahead(key: string): void {
    const query = readTypeaheadQuery(key);
    if (query === null) return;

    const visibleOptions = getVisibleEnabledOptionEntries();
    if (visibleOptions.length === 0) return;

    const currentIndex = highlighted === null
      ? -1
      : visibleOptions.findIndex(([itemValue]) => itemValue === highlighted);

    const match = typeaheadSearch({
      items: visibleOptions,
      query,
      currentIndex,
      getLabel: ([, option]) => option.label,
    });

    if (match) setHighlighted(match[0]);
  }

  function getVisibleEnabledOptionEntries(): Array<[string, SelectOptionMetadata]> {
    const entries: Array<[string, SelectOptionMetadata]> = [];
    for (const [itemValue, option] of options) {
      if (!option.disabled && matchesSearch(option.label, searchQuery)) {
        entries.push([itemValue, option]);
      }
    }
    return entries;
  }

  function getVisibleEnabledOptions(): string[] {
    return getVisibleEnabledOptionEntries().map(([itemValue]) => itemValue);
  }

  function moveSearchHighlight(direction: 1 | -1): void {
    const visibleOptions = getVisibleEnabledOptions();
    if (visibleOptions.length === 0) return;

    const currentIndex = highlighted === null ? -1 : visibleOptions.indexOf(highlighted);
    const nextIndex =
      currentIndex < 0
        ? direction > 0 ? 0 : visibleOptions.length - 1
        : (currentIndex + direction + visibleOptions.length) % visibleOptions.length;
    setHighlighted(visibleOptions[nextIndex]!);
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

  const { present, onAnimationEnd } = usePresence({ open: isDropdown && open, ref: containerRef });
  const { position, contentRef: floatingContentRef } = useFloatingPosition({
    triggerRef,
    open: isDropdown && present,
    side,
    align,
    sideOffset,
    alignOffset: 0,
    collisionPadding,
    avoidCollisions: true,
  });

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
    if (isDropdown) {
      setTriggerWidth(triggerRef.current?.getBoundingClientRect().width);
    }
    if (!searchInputRef.current) {
      containerRef.current?.focus();
    }
    initHighlight();
  }, [initHighlight, isDropdown, open, searchInputRef, triggerRef]);

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
    : { ...listboxPropsBase, onKeyDown: handleKeyDown } satisfies ListboxProps;
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

  if (!present) return null;

  return (
    <Portal>
      <div
        {...(hasSearch ? { onKeyDown: handleKeyDown } : listboxProps)}
        ref={hasSearch ? composeRefs(selectContentRef, floatingContentRef, ref) : composeRefs(containerRef, selectContentRef, floatingContentRef, ref)}
        data-state={open ? "open" : "closed"}
        data-side={position?.side}
        onAnimationEnd={onAnimationEnd}
        className={cn(
          "fixed z-[var(--z-popover)] border border-border bg-background shadow-2xl rounded-sm overflow-hidden outline-none",
          "data-[state=open]:animate-slide-in",
          "data-[state=closed]:animate-slide-out",
          className,
        )}
        style={
          position
            ? { top: position.y, left: position.x, width: triggerWidth }
            : { visibility: "hidden" as const, position: "fixed" as const, top: 0, left: 0 }
        }
      >
        {contentBody}
        {searchQuery && <MatchCount options={options} searchQuery={searchQuery} />}
      </div>
    </Portal>
  );
}

function SearchableContent({
  children,
  listboxProps,
  ref,
}: {
  children: ReactNode;
  listboxProps: SearchableListboxProps;
  ref: Ref<HTMLDivElement>;
}) {
  const { searchChildren, optionChildren, emptyChildren } = partitionSelectSearchChildren(children);

  return (
    <>
      {searchChildren}
      <div {...listboxProps} ref={ref} className="p-1 space-y-0.5 outline-none">
        {optionChildren}
      </div>
      {emptyChildren}
    </>
  );
}

function isSelectSearchElement(child: ReactNode): boolean {
  return isValidElement(child) && child.type === SelectSearch;
}

function isSelectEmptyElement(child: ReactNode): boolean {
  return isValidElement(child) && child.type === SelectEmpty;
}

function partitionSelectSearchChildren(children: ReactNode): {
  searchChildren: ReactNode[];
  optionChildren: ReactNode[];
  emptyChildren: ReactNode[];
} {
  const searchChildren: ReactNode[] = [];
  const optionChildren: ReactNode[] = [];
  const emptyChildren: ReactNode[] = [];

  Children.forEach(children, (child) => {
    if (isSelectSearchElement(child)) {
      searchChildren.push(child);
      return;
    }

    if (isSelectEmptyElement(child)) {
      emptyChildren.push(child);
      return;
    }

    if (!isValidElement<{ children?: ReactNode }>(child) || !containsPartitionedSelectElement(child.props.children)) {
      optionChildren.push(child);
      return;
    }

    const nested = partitionSelectSearchChildren(child.props.children);
    searchChildren.push(...nested.searchChildren);
    emptyChildren.push(...nested.emptyChildren);
    if (nested.optionChildren.length === 0) return;

    if (child.type === Fragment) {
      optionChildren.push(...nested.optionChildren);
    } else {
      optionChildren.push(cloneElement(child, undefined, nested.optionChildren));
    }
  });

  return { searchChildren, optionChildren, emptyChildren };
}

function containsSelectSearchElement(children: ReactNode): boolean {
  return Children.toArray(children).some((child) => {
    if (isSelectSearchElement(child)) return true;
    if (!isValidElement<{ children?: ReactNode }>(child)) return false;
    return containsSelectSearchElement(child.props.children);
  });
}

function containsPartitionedSelectElement(children: ReactNode): boolean {
  return Children.toArray(children).some((child) => {
    if (isSelectSearchElement(child) || isSelectEmptyElement(child)) return true;
    if (!isValidElement<{ children?: ReactNode }>(child)) return false;
    return containsPartitionedSelectElement(child.props.children);
  });
}

function MatchCount({ options, searchQuery }: { options: ReadonlyMap<string, SelectOptionMetadata>; searchQuery: string }) {
  let count = 0;
  for (const option of options.values()) {
    if (matchesSearch(option.label, searchQuery)) count++;
  }
  return (
    <div role="status" aria-live="polite" className="sr-only">
      {count} results
    </div>
  );
}
