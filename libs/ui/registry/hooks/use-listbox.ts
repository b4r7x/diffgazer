"use client";

import {
  Children,
  type ElementType,
  isValidElement,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useControllableState } from "@/hooks/use-controllable-state";
import { type NavigationRole, useNavigation } from "@/hooks/use-navigation";
import { useTypeaheadBuffer } from "@/hooks/use-typeahead-buffer";
import { composeRefs } from "@/lib/compose-refs";
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
  children?: ReactNode;
}

export interface UseListboxOptions<TId extends string = string> {
  selectedId?: TId | null;
  defaultSelectedId?: TId | null;
  highlighted?: TId | null;
  defaultHighlighted?: TId | null;
  onSelect?: (id: TId) => void;
  onEnter?: (id: TId, event: globalThis.KeyboardEvent) => void;
  onHighlightChange?: (id: TId | null) => void;
  onNavigationBoundaryReached?: (
    direction: "previous" | "next",
    event: globalThis.KeyboardEvent,
    key: string,
  ) => void;
  wrap?: boolean;
  idPrefix: string;
  autoFocus?: boolean;
  onKeyDown?: (event: KeyboardEvent) => void;
  role?: "listbox" | "menu";
  itemRole?: Extract<NavigationRole, "option" | "menuitem" | "menuitemradio">;
  typeahead?: boolean;
  items?: ListboxMetadataItem<TId>[];
  getItemId?: (idPrefix: string, id: TId) => string;
}

export interface UseListboxReturn<TId extends string = string> {
  selectedId: TId | null;
  highlighted: TId | null;
  handleItemHighlight: (id: TId | null) => void;
  handleItemActivate: (id: TId) => void;
  getContainerProps: (ref?: Ref<HTMLDivElement>) => {
    ref: ReturnType<typeof composeRefs<HTMLDivElement>>;
    role: string;
    tabIndex: 0;
    "aria-activedescendant": string | undefined;
    onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void;
  };
}

export function collectListboxItems<TId extends string = string>(
  children: ReactNode,
  itemType: ElementType,
): ListboxMetadataItem<TId>[] {
  const items: ListboxMetadataItem<TId>[] = [];

  Children.forEach(children, (child) => {
    if (!isValidElement<ListboxItemElementProps>(child)) return;
    if (child.type === itemType && typeof child.props.id === "string") {
      // Child id is opaque to TS; consumers parameterize TId.
      items.push({ id: child.props.id as TId, disabled: child.props.disabled });
      return;
    }
    items.push(...collectListboxItems<TId>(child.props.children, itemType));
  });

  return items;
}

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
}: UseListboxOptions<TId>): UseListboxReturn<TId> {
  const containerRef = useRef<HTMLDivElement>(null);
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: syncDomActiveDescendant is a useEffectEvent; activeDescendantCandidate and items are intentional triggers that must re-run the DOM sync when they change.
  useLayoutEffect(() => {
    syncDomActiveDescendant();
  }, [activeDescendantCandidate, items]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: syncDomActiveDescendant is a useEffectEvent that reads containerRole/getItemId/idPrefix/itemRole; these are intentional triggers that must re-subscribe the MutationObserver when the listbox identity changes.
  useLayoutEffect(() => {
    if (items) return;
    syncDomActiveDescendant();
    const container = containerRef.current;
    const view = container?.ownerDocument.defaultView;
    if (!container || !view?.MutationObserver) return;

    const observer = new view.MutationObserver(syncDomActiveDescendant);
    observer.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-disabled", "data-disabled", "data-value", "id", "role"],
    });
    return () => observer.disconnect();
  }, [containerRole, getItemId, idPrefix, itemRole, items]);

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

  const ensureActiveItem = useCallback(() => {
    if (activeDescendant !== null) return;
    const firstItemId = getFirstNavigableItemId<TId>(
      containerRef.current,
      itemRole,
      containerRole,
      items,
    );
    if (firstItemId !== null) setHighlighted(firstItemId);
  }, [activeDescendant, containerRole, itemRole, items, setHighlighted]);

  useEffect(() => {
    if (!autoFocus) return;

    const frame = requestAnimationFrame(() => {
      const container = containerRef.current;
      if (!container) return;

      if (!container.contains(container.ownerDocument.activeElement)) {
        container.focus({ preventScroll: true });
      }

      ensureActiveItem();
    });

    return () => cancelAnimationFrame(frame);
  }, [autoFocus, ensureActiveItem]);

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

  const handleTypeahead = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (!typeahead) return;

    const container = containerRef.current;
    if (!container) return;

    // Owner-scoping: when a key bubbles up from a nested composite (inner listbox/menu),
    // do not let the outer composite's typeahead consume it.
    const target = event.target as HTMLElement | null;
    if (target && target !== container) {
      const ownerSelector = getListboxOwnerSelector(containerRole);
      const targetOwner = target.closest(ownerSelector);
      if (targetOwner && targetOwner !== container) return;
    }

    const queryText = readTypeaheadQuery(event.key);
    if (queryText === null) return;

    const typeaheadItems = getListboxItems(
      container,
      itemRole,
      containerRole,
      containerRole === "menu",
    ).filter((item) => item.dataset.value !== undefined);
    if (typeaheadItems.length === 0) return;

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
      if (value === undefined) return;
      setHighlighted(value as TId);
      match.scrollIntoView?.({ block: "nearest" });
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e);
    if (!e.defaultPrevented) {
      navKeyDown(e);
      if (!e.ctrlKey && !e.metaKey && !e.altKey) handleTypeahead(e);
    }
  };

  const getContainerProps = (ref?: Ref<HTMLDivElement>) => ({
    ref: composeRefs(containerRef, ref),
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
