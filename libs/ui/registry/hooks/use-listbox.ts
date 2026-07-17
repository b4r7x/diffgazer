"use client";

import { composedClosest, composedContains, isEditableElement } from "@diffgazer/keys";
import {
  Children,
  Fragment,
  isValidElement,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  type Ref,
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useComposedRefs } from "@/hooks/use-composed-refs";
import { useControllableState } from "@/hooks/use-controllable-state";
import { type NavigationRole, useNavigation } from "@/hooks/use-navigation";
import { useTypeaheadBuffer } from "@/hooks/use-typeahead-buffer";
import { typeaheadSearch } from "@/lib/typeahead";
import {
  getAccessibleText,
  getEncodedListboxItemId,
  getFirstNavigableItemId,
  getListboxItems,
  getListboxOwnerSelector,
  hasDomItem,
  resolveActiveDescendant,
} from "./listbox-dom";
import { hasEnabledMetadataItem, type ListboxMetadataItem } from "./listbox-metadata";

export { getEncodedListboxItemId };
export type { ListboxMetadataItem };

interface ListboxItemElementProps {
  id?: string;
  disabled?: boolean;
  hidden?: boolean;
  inert?: boolean;
  "aria-hidden"?: boolean | "true" | "false";
  expanded?: boolean;
  defaultExpanded?: boolean;
  children?: ReactNode;
}

type ListboxChildType = ReactElement["type"];

interface CollectListboxItemsOptions {
  itemTypes: readonly ListboxChildType[];
  containerTypes?: readonly ListboxChildType[];
}

/**
 * Options for shared listbox selection, highlight, keyboard navigation, and ARIA wiring.
 *
 * @typeParam TId - Convenience assertion for the id union flowing through
 * `onSelect`/`onEnter`/`onHighlightChange`. Ids originate from item children
 * props or DOM dataset strings and are asserted to `TId`, not validated. The
 * consuming compound component owns the dev-mode unregistered-id guard (it holds
 * the authoritative registered set; see `warnUnregisteredValue`).
 */
export interface UseListboxOptions<TId extends string = string> {
  /** Controlled selected item ID. When provided, the hook is in controlled mode for selection. */
  selectedId?: TId | null;
  /** Initial selected item ID for uncontrolled mode. */
  defaultSelectedId?: TId | null;
  /** Controlled highlighted item ID. When provided, the hook is in controlled mode for highlight. */
  highlighted?: TId | null;
  /** Initial highlighted item ID for uncontrolled mode. */
  defaultHighlighted?: TId | null;
  /** Called when the selected item changes. */
  onSelect?: (id: TId) => void;
  /** Called when Enter activates the highlighted item. Selection is committed before this callback runs. */
  onEnter?: (id: TId, event: globalThis.KeyboardEvent) => void;
  /** Called when the highlighted item changes via keyboard navigation or is cleared. */
  onHighlightChange?: (id: TId | null) => void;
  /** Called when wrap is false and keyboard navigation attempts to move before the first item or after the last item. */
  onNavigationBoundaryReached?: (
    direction: "previous" | "next",
    event: globalThis.KeyboardEvent,
    key: string,
  ) => void;
  /** Whether keyboard navigation wraps from last item to first and vice versa. @default true */
  wrap?: boolean;
  /** Prefix for generating aria-activedescendant IDs. Each option should use id="{idPrefix}-{itemId}". */
  idPrefix: string;
  /** Focus the container on mount and initialize highlight to the selected item or first navigable item. @default false */
  autoFocus?: boolean;
  /** Additional keydown handler called before built-in navigation. Call event.preventDefault() to suppress navigation. */
  onKeyDown?: (event: KeyboardEvent) => void;
  /** ARIA role for the container element. @default "listbox" */
  role?: "listbox" | "menu";
  /** ARIA role for each item element. @default "option" */
  itemRole?: Extract<NavigationRole, "option" | "menuitem" | "menuitemradio">;
  /** Enable type-ahead character search to jump to matching items. @default false */
  typeahead?: boolean;
  /** Optional metadata array describing each item. DOM lookup is still used for mounted item text and typeahead. */
  items?: ListboxMetadataItem<TId>[];
  /** Override how option DOM IDs are derived from idPrefix and item ID. */
  getItemId?: (idPrefix: string, id: TId) => string;
  /**
   * Consumer/forwarded ref for the container element. Composed with the hook's
   * internal container ref once (via {@link useComposedRefs}) so
   * `getContainerProps` returns a stable `ref` callback instead of re-wrapping
   * during render.
   */
  ref?: Ref<HTMLDivElement>;
}

/** Selection state, highlight state, item handlers, and a container prop getter. */
export interface UseListboxReturn<TId extends string = string> {
  /** Currently selected item ID. */
  selectedId: TId | null;
  /** Currently highlighted item ID. */
  highlighted: TId | null;
  /** Call on item hover or focus to highlight it. */
  handleItemHighlight: (id: TId | null) => void;
  /** Call on item click or Enter/Space to select and activate it. */
  handleItemActivate: (id: TId) => void;
  /** Returns ARIA, focus, ref, and keydown props for the listbox container. */
  getContainerProps: () => {
    ref: Ref<HTMLDivElement>;
    role: string;
    tabIndex: 0;
    "aria-activedescendant": string | undefined;
    onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void;
  };
}

function isRenderSeedHidden(props: ListboxItemElementProps): boolean {
  return (
    props.hidden === true ||
    props.inert === true ||
    props["aria-hidden"] === true ||
    props["aria-hidden"] === "true"
  );
}

function isRenderSeedContainerVisible(props: ListboxItemElementProps): boolean {
  return !isRenderSeedHidden(props) && (props.expanded ?? props.defaultExpanded ?? true);
}

/** Collects item IDs and disabled state that are inspectable during render. */
export function collectListboxItems<TId extends string = string>(
  children: ReactNode,
  { itemTypes, containerTypes = [] }: CollectListboxItemsOptions,
): ListboxMetadataItem<TId>[] {
  const items: ListboxMetadataItem<TId>[] = [];

  Children.forEach(children, (child) => {
    if (!isValidElement<ListboxItemElementProps>(child)) return;
    if (itemTypes.includes(child.type) && typeof child.props.id === "string") {
      if (isRenderSeedHidden(child.props)) return;
      // Child id is opaque to TS; consumers parameterize TId.
      items.push({ id: child.props.id as TId, disabled: child.props.disabled });
      return;
    }
    if (
      child.type === Fragment ||
      (containerTypes.includes(child.type) && isRenderSeedContainerVisible(child.props))
    ) {
      items.push(...collectListboxItems<TId>(child.props.children, { itemTypes, containerTypes }));
    }
  });

  return items;
}

/** Shared listbox state and keyboard navigation hook. */
export function useListbox<TId extends string = string>({
  selectedId: controlledSelectedId,
  defaultSelectedId = null,
  highlighted: controlledHighlighted,
  defaultHighlighted = null,
  onSelect,
  onEnter,
  onHighlightChange,
  onNavigationBoundaryReached,
  wrap = true,
  idPrefix,
  autoFocus = false,
  onKeyDown,
  role: containerRole = "listbox",
  itemRole = "option",
  typeahead = false,
  items,
  getItemId = getEncodedListboxItemId as (idPrefix: string, id: TId) => string,
  ref,
}: UseListboxOptions<TId>): UseListboxReturn<TId> {
  const containerRef = useRef<HTMLDivElement>(null);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const attachContainer = useCallback((node: HTMLDivElement | null) => {
    containerRef.current = node;
    setContainer((current) => (current === node ? current : node));
  }, []);
  const composedContainerRef = useComposedRefs(attachContainer, ref);
  const autoFocusInitialized = useRef(false);
  const [domActiveDescendant, setDomActiveDescendant] = useState<string | null>(null);
  const readTypeaheadQuery = useTypeaheadBuffer();

  const query = {
    itemRole,
    containerRole,
    idPrefix,
    getItemId: getItemId as (idPrefix: string, id: string) => string,
  };

  const [selectedId, setSelectedId] = useControllableState<TId | null>({
    value: controlledSelectedId,
    defaultValue: defaultSelectedId,
    onChange: (next) => {
      if (next !== null) onSelect?.(next);
    },
  });

  const [highlighted, setHighlighted] = useControllableState<TId | null>({
    value: controlledHighlighted,
    defaultValue: defaultHighlighted,
    onChange: onHighlightChange,
  });

  const activeDescendantCandidate = resolveActiveDescendant<TId>(
    items,
    highlighted,
    selectedId,
    containerRole,
  );
  const activeDescendant = items ? activeDescendantCandidate : (domActiveDescendant as TId | null);

  const syncDomActiveDescendant = useEffectEvent(() => {
    if (items) return;
    const next = hasDomItem({
      container: containerRef.current,
      query,
      id: activeDescendantCandidate,
      includeDisabled: containerRole === "menu",
    })
      ? activeDescendantCandidate
      : null;
    setDomActiveDescendant((current) => (current === next ? current : next));
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: syncDomActiveDescendant is a useEffectEvent; the attached container, activeDescendantCandidate, and items are intentional sync triggers.
  useLayoutEffect(() => {
    syncDomActiveDescendant();
  }, [container, activeDescendantCandidate, items]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: syncDomActiveDescendant is a useEffectEvent that reads the query inputs listed here; the attached container keys observer ownership.
  useLayoutEffect(() => {
    if (items) return;
    syncDomActiveDescendant();
    const view = container?.ownerDocument.defaultView;
    if (!container || !view?.MutationObserver) return;

    const observer = new view.MutationObserver(() => {
      if (containerRef.current === container) syncDomActiveDescendant();
    });
    observer.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        "aria-disabled",
        "aria-hidden",
        "data-disabled",
        "data-value",
        "hidden",
        "id",
        "inert",
        "role",
      ],
    });
    return () => observer.disconnect();
  }, [container, containerRole, getItemId, idPrefix, itemRole, items]);

  const isItemEnabled = (id: TId) => {
    return items
      ? hasEnabledMetadataItem(items, id)
      : hasDomItem({ container: containerRef.current, query, id });
  };

  const activateItem = (next: TId) => {
    setSelectedId(next);
    setHighlighted(next);
  };

  const handleItemActivate = (next: TId) => {
    if (!isItemEnabled(next)) return;
    activateItem(next);
  };

  const handleItemEnter = (next: TId, event: globalThis.KeyboardEvent) => {
    if (!isItemEnabled(next)) return;
    activateItem(next);
    onEnter?.(next, event);
  };

  const ensureActiveItem = () => {
    if (activeDescendant !== null) return true;
    const firstItemId = getFirstNavigableItemId<TId>(
      containerRef.current,
      itemRole,
      containerRole,
      items,
    );
    if (firstItemId === null) return false;
    setHighlighted(firstItemId);
    return true;
  };

  // A submenu can mount before its children finish registering. Retry on the
  // metadata update, but only until the first successful initialization.
  const runAutoFocusInit = useEffectEvent(() => {
    const container = containerRef.current;
    if (!container) return false;

    if (!container.contains(container.ownerDocument.activeElement)) {
      container.focus({ preventScroll: true });
    }

    return ensureActiveItem();
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: items is the retry trigger; the callback reads the latest state through an Effect Event.
  useEffect(() => {
    if (!autoFocus) {
      autoFocusInitialized.current = false;
      return;
    }
    if (autoFocusInitialized.current) return;

    const frame = requestAnimationFrame(() => {
      if (runAutoFocusInit()) autoFocusInitialized.current = true;
    });
    return () => cancelAnimationFrame(frame);
  }, [autoFocus, items]);

  const { onKeyDown: navKeyDown } = useNavigation<TId>({
    containerRef,
    role: itemRole,
    wrap,
    highlighted: highlighted ?? selectedId ?? undefined,
    onHighlightChange: setHighlighted,
    onEnter: handleItemEnter,
    onSelect: handleItemActivate,
    onNavigationBoundaryReached,
    scopeToContainer: true,
    // APG: menu items remain focusable when disabled.
    skipDisabled: containerRole !== "menu",
  });

  // Returns true when the key was buffered into the typeahead query so the
  // caller can suppress a competing Space-select for the same keystroke.
  const handleTypeahead = (event: KeyboardEvent<HTMLDivElement>): boolean => {
    if (!typeahead) return false;

    const container = containerRef.current;
    if (!container) return false;

    const composedTarget = event.nativeEvent.composedPath()[0] ?? event.target;
    const typeaheadItems = getListboxItems(
      container,
      itemRole,
      containerRole,
      containerRole === "menu",
    ).filter((item) => item.dataset.value !== undefined);
    const view = container.ownerDocument.defaultView;
    const target = view && composedTarget instanceof view.HTMLElement ? composedTarget : null;
    const isOwnItem =
      target !== null && typeaheadItems.some((item) => composedContains(item, target));
    if (isEditableElement(composedTarget) && !isOwnItem) return false;

    // Owner-scoping: when a key bubbles up from a nested composite (inner listbox/menu),
    // do not let the outer composite's typeahead consume it.
    if (target && target !== container) {
      const ownerSelector = getListboxOwnerSelector(containerRole);
      const targetOwner = composedClosest(target, ownerSelector);
      if (targetOwner && targetOwner !== container) return false;
    }

    const queryText = readTypeaheadQuery(event.key);
    if (queryText === null) return false;

    if (typeaheadItems.length === 0) return true;

    const currentValue = highlighted ?? selectedId;
    const currentIndex =
      currentValue === null
        ? -1
        : typeaheadItems.findIndex((item) => item.dataset.value === currentValue);

    const match = typeaheadSearch({
      items: typeaheadItems,
      query: queryText,
      currentIndex,
      getLabel: (item) => getAccessibleText(item).trim(),
    });

    if (match) {
      const value = match.dataset.value;
      if (value === undefined) return true;
      setHighlighted(value as TId);
      match.scrollIntoView?.({ block: "nearest" });
    }
    return true;
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    const isModified = e.ctrlKey || e.metaKey || e.altKey;
    // Space extends an in-progress typeahead query instead of selecting; run
    // typeahead first for Space so a non-empty buffer suppresses the Space-select
    // that navKeyDown would otherwise dispatch for the same keystroke.
    if (e.key === " " && !isModified && handleTypeahead(e)) return;
    navKeyDown(e);
    if (e.key !== " " && !isModified) handleTypeahead(e);
  };

  const getContainerProps = () => ({
    ref: composedContainerRef,
    role: containerRole,
    tabIndex: 0 as const,
    "aria-activedescendant":
      activeDescendant !== null ? getItemId(idPrefix, activeDescendant) : undefined,
    onKeyDown: handleKeyDown,
  });

  return {
    selectedId,
    highlighted,
    handleItemHighlight: setHighlighted,
    handleItemActivate,
    getContainerProps,
  };
}
