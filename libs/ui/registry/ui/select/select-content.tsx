"use client";

import {
  isValidElement,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
  useCallback,
  useEffectEvent,
  useLayoutEffect,
  useRef,
} from "react";
import { useComposedRefs } from "@/hooks/use-composed-refs";
import type { FloatingAlign, FloatingSide } from "@/hooks/use-floating-position";
import { useNavigation } from "@/hooks/use-navigation";
import { useEscapeKey } from "@/hooks/use-outside-click";
import { matchesSearch } from "@/lib/search";
import { cn } from "@/lib/utils";
import { FloatingPanel, useFloatingPanelContext } from "../floating-panel";
import { useAriaLinkedPortalContainer } from "../shared/portal";
import { SearchableContent, type SearchableListboxProps } from "./searchable-content";
import type { SelectOptionMetadata } from "./select-context";
import { useSelectContext } from "./select-context";
import { SelectSearch } from "./select-search";
import { containsSelectSearchElement, isActiveOptionVisible, toOptionId } from "./selection";
import { useSelectTypeahead } from "./use-typeahead";
import { getVisibleEnabledOptions } from "./visible-options";

function isComposingKeyEvent(event: { isComposing?: boolean; keyCode?: number }): boolean {
  return event.isComposing === true || event.keyCode === 229;
}

function SelectDropdownInitializer({
  open,
  onFocus,
  onInitialize,
}: {
  open: boolean;
  onFocus: () => boolean;
  onInitialize: () => boolean;
}) {
  const { positioned } = useFloatingPanelContext();
  const { options } = useSelectContext("SelectDropdownInitializer");
  const focusedRef = useRef(false);
  const highlightInitializedRef = useRef(false);
  // Effect events must be created where they run; parents pass plain closures.
  const focus = useEffectEvent(onFocus);
  const initialize = useEffectEvent(onInitialize);

  useLayoutEffect(() => {
    if (!open || !positioned) {
      focusedRef.current = false;
      highlightInitializedRef.current = false;
      return;
    }

    if (!focusedRef.current) {
      focusedRef.current = focus();
    }

    if (!highlightInitializedRef.current && options.size > 0) {
      highlightInitializedRef.current = initialize();
    }
  }, [open, options, positioned]);

  return null;
}

/** Props for select content. */
export interface SelectContentProps {
  /** Content rendered inside the component. */
  children: ReactNode;
  /** Additional class names merged onto the rendered element. */
  className?: string;
  /** Called when key down occurs. */
  onKeyDown?: (event: KeyboardEvent) => void;
  /** Side where the element appears. */
  side?: FloatingSide;
  /** Alignment relative to the anchor. */
  align?: FloatingAlign;
  /** Offset in px between the trigger and the dropdown panel (default 4). */
  sideOffset?: number;
  /** Minimum px gap kept from the viewport edge during collision avoidance (default 8). */
  collisionPadding?: number;
  /** Portal container the dropdown mounts into; defaults to document.body. */
  portalContainer?: Element | null;
  /** Live-region results-count text for searchable selects. Defaults to `${count} results`. */
  getResultsLabel?: (count: number) => string;
  /** Ref forwarded to the underlying element. */
  ref?: Ref<HTMLDivElement>;
}

const SEARCH_INPUT_NAV_KEYS = new Set(["ArrowUp", "ArrowDown", "Enter"]);
/** Dropdown listbox with keyboard navigation. */
export function SelectContent({
  children,
  className,
  onKeyDown,
  side = "bottom",
  align = "start",
  // Tighter than FloatingPanel's default 6 so the dropdown reads as attached to the trigger.
  sideOffset = 4,
  collisionPadding = 8,
  portalContainer,
  getResultsLabel,
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
    ariaDescribedBy,
  } = useSelectContext("SelectContent");
  const containerRef = useRef<HTMLDivElement>(null);
  const isDropdown = variant !== "card";
  const hasSearch = containsSelectSearchElement(children, isSelectSearchElement);
  const searchComposedRef = useComposedRefs(selectContentRef, ref);
  const fullComposedRef = useComposedRefs(containerRef, selectContentRef, ref);
  const composedRef = hasSearch ? searchComposedRef : fullComposedRef;
  const resolvedPortalContainer = useAriaLinkedPortalContainer(
    portalContainer,
    triggerRef,
    "Select",
  );

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
    [listboxId],
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

  const initHighlight = () => {
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
    return initHighlight();
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
      contains: (target) => target !== null && (selectContentRef.current?.contains(target) ?? false),
    },
  );

  useLayoutEffect(() => {
    if (hasSearch || !searchInputRef.current || process.env.NODE_ENV === "production") {
      return;
    }
    console.warn(
      "Select: Select.Search rendered through a component wrapper cannot be hoisted out of the listbox. Render Select.Search directly, in a Fragment, or in a DOM wrapper.",
    );
  }, [hasSearch, searchInputRef]);

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
    : {
        ...listboxPropsBase,
        "aria-describedby": ariaDescribedBy || undefined,
        onKeyDown: handleKeyDown,
      };
  const contentBody = hasSearch ? (
    <SearchableContent listboxProps={listboxProps} ref={containerRef}>
      {children}
    </SearchableContent>
  ) : (
    children
  );

  if (!isDropdown) {
    return (
      <div
        {...(hasSearch ? { onKeyDown: handleKeyDown } : listboxProps)}
        ref={composedRef}
        hidden={!open}
        className={cn("w-full overflow-hidden p-1 space-y-0.5 outline-none", className)}
      >
        {contentBody}
        {hasSearch && (
          <MatchCount
            options={options}
            searchQuery={searchQuery}
            getResultsLabel={getResultsLabel}
          />
        )}
      </div>
    );
  }

  return (
    <FloatingPanel
      {...(hasSearch ? { onKeyDown: handleKeyDown } : listboxProps)}
      open={open}
      triggerRef={triggerRef}
      portalContainer={resolvedPortalContainer}
      side={side}
      align={align}
      sideOffset={sideOffset}
      collisionPadding={collisionPadding}
      avoidCollisions
      matchTriggerWidth
      ref={composedRef}
      className={cn(
        "border border-border bg-background shadow-2xl rounded-sm overflow-y-auto outline-none",
        className,
      )}
      // Cap the dropdown to the room FloatingPanel reports and scroll long lists
      // instead of overflowing the viewport (the var is set on this element).
      style={{
        width: "var(--ui-floating-trigger-width)",
        maxHeight: "var(--floating-panel-available-height)",
      }}
    >
      <SelectDropdownInitializer
        open={open}
        onFocus={focusOpenContent}
        onInitialize={initHighlight}
      />
      {contentBody}
      {hasSearch && (
        <MatchCount options={options} searchQuery={searchQuery} getResultsLabel={getResultsLabel} />
      )}
    </FloatingPanel>
  );
}

function isSelectSearchElement(child: ReactNode): boolean {
  return isValidElement(child) && child.type === SelectSearch;
}

function MatchCount({
  options,
  searchQuery,
  getResultsLabel,
}: {
  options: ReadonlyMap<string, SelectOptionMetadata>;
  searchQuery: string;
  getResultsLabel?: (count: number) => string;
}) {
  // Mount the live region empty before any query: a region that enters the DOM
  // already containing text is often not announced by SR/browser pairs.
  let count = 0;
  for (const option of options.values()) {
    if (matchesSearch(option.label, searchQuery)) count++;
  }
  return (
    // biome-ignore lint/a11y/useSemanticElements: role="status" is the sr-only results-count live region; <output> carries form-association semantics that do not fit here.
    <div role="status" aria-live="polite" className="sr-only">
      {searchQuery ? (getResultsLabel?.(count) ?? `${count} results`) : ""}
    </div>
  );
}
