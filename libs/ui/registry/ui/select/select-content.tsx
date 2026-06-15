"use client";

import {
  Children,
  isValidElement,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
  type RefObject,
  useCallback,
  useEffectEvent,
  useLayoutEffect,
  useRef,
} from "react";
import { useComposedRefs } from "@/hooks/use-composed-refs";
import type { FloatingAlign, FloatingSide } from "@/hooks/use-floating-position";
import { useNavigation } from "@/hooks/use-navigation";
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

function containsRefElement(ref: RefObject<HTMLElement | null>, target: Node | null): boolean {
  return target !== null && (ref.current?.contains(target) ?? false);
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
  /** side offset used by select content. */
  sideOffset?: number;
  /** collision padding used by select content. */
  collisionPadding?: number;
  /** portal container used by select content. */
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
  // Tighter than FloatingPanel's default (6) so the dropdown reads as visually
  // attached to the trigger. Override per-instance via the prop.
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
  } = useSelectContext("SelectContent");
  const containerRef = useRef<HTMLDivElement>(null);
  const isDropdown = variant !== "card";
  const hasSearch = containsSelectSearchElement(children);
  const searchComposedRef = useComposedRefs(selectContentRef, ref);
  const fullComposedRef = useComposedRefs(containerRef, selectContentRef, ref);
  const composedRef = hasSearch ? searchComposedRef : fullComposedRef;

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

  // Bring a newly highlighted option into view for the non-arrow paths
  // (typeahead, searchable arrow nav). The arrow path inside useNavigation
  // already scrolls; these two end at setHighlighted, so without this an
  // off-screen active descendant stays invisible (the activedescendant
  // analogue of WCAG 2.4.11), mirroring use-listbox's typeahead scroll.
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
    if (highlighted !== null) return;
    let selectedValues: string[] = [];
    if (Array.isArray(value)) {
      selectedValues = value;
    } else if (value !== null) {
      selectedValues = [value];
    }
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
  };

  // Read current highlight/value/options through an Effect Event so the focus +
  // init only runs on the open transition. Keying it to initHighlight's identity
  // re-fired on unrelated re-renders while open and re-stole focus from the user.
  const runOpenInit = useEffectEvent(() => {
    if (!searchInputRef.current) {
      containerRef.current?.focus();
    }
    initHighlight();
  });

  useLayoutEffect(() => {
    if (!open) return;
    runOpenInit();
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;

    const ownerDocument = containerRef.current?.ownerDocument ?? triggerRef.current?.ownerDocument;
    if (!ownerDocument) return;

    const handleDocumentKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;

      const NodeCtor = ownerDocument.defaultView?.Node;
      const targetNode = NodeCtor && event.target instanceof NodeCtor ? event.target : null;
      const targetIsInsideContent = containsRefElement(selectContentRef, targetNode);
      if (event.defaultPrevented && targetIsInsideContent) return;

      event.preventDefault();
      onOpenChange(false);
      triggerRef.current?.focus();
    };

    ownerDocument.addEventListener("keydown", handleDocumentKeyDown);
    return () => ownerDocument.removeEventListener("keydown", handleDocumentKeyDown);
  }, [open, onOpenChange, selectContentRef, triggerRef]);

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
      // Restore focus to the trigger synchronously (mirroring the Escape branch)
      // for every mode — multiple and searchable null-highlight never run the
      // single-select commit that refocuses, so without this Tab would leave
      // focus in the portaled panel and drop to the end of <body>. The default
      // Tab action then advances from the trigger to the next element.
      triggerRef.current?.focus();
      return;
    }

    const isTyping = e.target === searchInputRef.current;
    if (isTyping) {
      handleSearchInputNavigation(e);
      return;
    }

    const isModified = e.ctrlKey || e.metaKey || e.altKey;
    // Space extends an in-progress typeahead query (e.g. "new y") instead of
    // selecting: run typeahead first for Space so a non-empty buffer suppresses
    // the Space-select that navKeyDown would otherwise dispatch.
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
    : { ...listboxPropsBase, onKeyDown: handleKeyDown };
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
      portalContainer={portalContainer}
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
      {contentBody}
      {hasSearch && (
        <MatchCount options={options} searchQuery={searchQuery} getResultsLabel={getResultsLabel} />
      )}
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

function MatchCount({
  options,
  searchQuery,
  getResultsLabel,
}: {
  options: ReadonlyMap<string, SelectOptionMetadata>;
  searchQuery: string;
  getResultsLabel?: (count: number) => string;
}) {
  // Mount the live region unconditionally (empty until a query exists) so it is
  // present in the DOM before its first announcement — a region that enters the
  // DOM already containing text is often not announced by SR/browser pairs.
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
