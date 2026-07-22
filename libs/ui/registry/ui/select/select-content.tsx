"use client";

import {
  isValidElement,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
  useEffectEvent,
  useLayoutEffect,
  useRef,
} from "react";
import { useComposedRefs } from "@/hooks/use-composed-refs";
import type { FloatingAlign, FloatingSide } from "@/hooks/use-floating-position";
import { matchesSearch } from "@/lib/search";
import { cn } from "@/lib/utils";
import { FloatingPanel, useFloatingPanelContext } from "../floating-panel";
import { useAriaLinkedPortalContainer } from "../shared/portal";
import { SearchableContent, type SearchableListboxProps } from "./searchable-content";
import type { SelectOptionMetadata } from "./select-context";
import { useSelectContext } from "./select-context";
import { SelectSearch } from "./select-search";
import { containsSelectSearchElement } from "./selection";
import { useSelectContentNavigation } from "./use-content-navigation";

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

  const { handleKeyDown, activeDescendant, focusOpenContent, initializeHighlight } =
    useSelectContentNavigation({
      containerRef,
      isDropdown,
      onKeyDown,
    });

  useLayoutEffect(() => {
    if (hasSearch || !searchInputRef.current || process.env.NODE_ENV === "production") {
      return;
    }
    console.warn(
      "Select: Select.Search rendered through a component wrapper cannot be hoisted out of the listbox. Render Select.Search directly, in a Fragment, or in a DOM wrapper.",
    );
  }, [hasSearch, searchInputRef]);

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
        onInitialize={initializeHighlight}
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
