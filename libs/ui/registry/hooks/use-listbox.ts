"use client";

import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  type ElementType,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from "react";
import { useNavigation, type NavigationRole } from "@/hooks/use-navigation";
import { useTypeaheadBuffer } from "@/hooks/use-typeahead-buffer";
import { useControllableState } from "@/hooks/use-controllable-state";
import { composeRefs } from "@/lib/compose-refs";
import { typeaheadSearch } from "@/lib/typeahead";

export interface ListboxMetadataItem {
  id: string;
  disabled?: boolean;
}

interface ListboxItemElementProps {
  id?: string;
  disabled?: boolean;
  children?: ReactNode;
}

export interface UseListboxOptions {
  selectedId?: string | null;
  defaultSelectedId?: string | null;
  highlighted?: string | null;
  defaultHighlighted?: string | null;
  onSelect?: (id: string) => void;
  onEnter?: (id: string, event: globalThis.KeyboardEvent) => void;
  onHighlightChange?: (id: string | null) => void;
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
  items?: ListboxMetadataItem[];
  getItemId?: (idPrefix: string, id: string) => string;
}

export interface UseListboxReturn {
  selectedId: string | null;
  highlighted: string | null;
  handleItemHighlight: (id: string | null) => void;
  handleItemActivate: (id: string) => void;
  getContainerProps: (ref?: Ref<HTMLDivElement>) => {
    ref: ReturnType<typeof composeRefs<HTMLDivElement>>;
    role: string;
    tabIndex: 0;
    "aria-activedescendant": string | undefined;
    onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void;
  };
}

export function getEncodedListboxItemId(idPrefix: string, id: string): string {
  return `${idPrefix}-${encodeURIComponent(id)}`;
}

export function collectListboxItems(
  children: ReactNode,
  itemType: ElementType,
): ListboxMetadataItem[] {
  const items: ListboxMetadataItem[] = [];

  Children.forEach(children, (child) => {
    if (!isValidElement<ListboxItemElementProps>(child)) return;
    if (child.type === itemType && typeof child.props.id === "string") {
      items.push({ id: child.props.id, disabled: child.props.disabled });
      return;
    }
    items.push(...collectListboxItems(child.props.children, itemType));
  });

  return items;
}

function hasDomItem(
  container: HTMLElement | null,
  itemRole: string,
  containerRole: "listbox" | "menu",
  idPrefix: string,
  id: string | null,
  getItemId: (idPrefix: string, id: string) => string,
  includeDisabled = false,
): id is string {
  if (!container || id === null) return false;
  const element = container.ownerDocument.getElementById(getItemId(idPrefix, id));
  const disabled = element?.getAttribute("aria-disabled") === "true" || element?.hasAttribute("data-disabled");
  return Boolean(
    element &&
      container.contains(element) &&
      isOwnedListboxItem(element, container, containerRole) &&
      element.getAttribute("role") === itemRole &&
      element.dataset.value === id &&
      (includeDisabled || !disabled),
  );
}

function hasEnabledMetadataItem(
  items: ListboxMetadataItem[],
  id: string | null,
): id is string {
  return id !== null && items.some((item) => item.id === id && !item.disabled);
}

function hasMetadataItem(items: ListboxMetadataItem[], id: string | null): id is string {
  return id !== null && items.some((item) => item.id === id);
}

function resolveActiveDescendant(
  items: ListboxMetadataItem[] | undefined,
  highlighted: string | null,
  selectedId: string | null,
  containerRole: "listbox" | "menu",
): string | null {
  if (!items) return highlighted ?? selectedId;
  // APG menus keep disabled items focusable, so they can be the active descendant.
  // Listboxes never expose disabled options as selected.
  if (containerRole === "menu") {
    if (hasMetadataItem(items, highlighted)) return highlighted;
    if (hasEnabledMetadataItem(items, selectedId)) return selectedId;
    return null;
  }
  if (hasEnabledMetadataItem(items, highlighted)) return highlighted;
  if (hasEnabledMetadataItem(items, selectedId)) return selectedId;
  return null;
}

function getAccessibleText(el: HTMLElement, visited: Set<HTMLElement> = new Set()): string {
  if (visited.has(el)) return "";
  visited.add(el);

  const ariaLabel = el.getAttribute("aria-label")?.trim();
  if (ariaLabel) return ariaLabel;

  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    const label = labelledBy
      .split(/\s+/)
      .map((id) => el.ownerDocument.getElementById(id))
      .filter((node): node is HTMLElement => node !== null)
      .map((node) => getAccessibleText(node, visited))
      .join(" ")
      .trim();
    if (label) return label;
  }

  let text = "";
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const child = node as HTMLElement;
      if (child.getAttribute("aria-hidden") !== "true") {
        text += getAccessibleText(child, visited);
      }
    }
  }
  return text;
}

function getListboxOwnerSelector(containerRole: "listbox" | "menu") {
  return containerRole === "listbox" ? '[role="listbox"]' : '[role="menu"]';
}

function isOwnedListboxItem(
  element: HTMLElement,
  container: HTMLElement,
  containerRole: "listbox" | "menu",
) {
  const owner = element.closest(getListboxOwnerSelector(containerRole));
  return owner === null || owner === container;
}

function getListboxItems(
  container: HTMLElement | null,
  itemRole: string,
  containerRole: "listbox" | "menu",
  includeDisabled = false,
) {
  if (!container) return [];
  const disabledFilter = includeDisabled ? "" : ':not([aria-disabled="true"]):not([data-disabled])';
  return Array.from(container.querySelectorAll<HTMLElement>(
    `[role="${itemRole}"]${disabledFilter}`,
  )).filter((item) => isOwnedListboxItem(item, container, containerRole));
}

function getFirstNavigableItemId(
  container: HTMLElement | null,
  itemRole: string,
  containerRole: "listbox" | "menu",
  items?: ListboxMetadataItem[],
): string | null {
  if (items) {
    const item = containerRole === "menu"
      ? items[0]
      : items.find((candidate) => !candidate.disabled);
    return item?.id ?? null;
  }

  const firstItem = getListboxItems(container, itemRole, containerRole, containerRole === "menu")[0];
  return firstItem?.dataset.value !== undefined ? firstItem.dataset.value : null;
}

export function useListbox({
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
  getItemId = getEncodedListboxItemId,
}: UseListboxOptions): UseListboxReturn {
  const containerRef = useRef<HTMLDivElement>(null);
  const [domActiveDescendant, setDomActiveDescendant] = useState<string | null>(null);
  const readTypeaheadQuery = useTypeaheadBuffer();

  const [selectedId, setSelectedId] = useControllableState<string | null>({
    value: controlledSelectedId,
    defaultValue: defaultSelectedId,
    onChange: (next) => {
      if (next !== null) onSelect?.(next);
    },
  });

  const [highlighted, setHighlighted] = useControllableState<string | null>({
    value: controlledHighlighted,
    defaultValue: defaultHighlighted,
    onChange: onHighlightChange,
  });

  const activeDescendantCandidate = resolveActiveDescendant(items, highlighted, selectedId, containerRole);
  const activeDescendant = items ? activeDescendantCandidate : domActiveDescendant;

  const syncDomActiveDescendant = useEffectEvent(() => {
    if (items) return;
    const next = hasDomItem(
      containerRef.current,
      itemRole,
      containerRole,
      idPrefix,
      activeDescendantCandidate,
      getItemId,
      containerRole === "menu",
    )
      ? activeDescendantCandidate
      : null;
    setDomActiveDescendant((current) => (current === next ? current : next));
  });

  useLayoutEffect(() => {
    syncDomActiveDescendant();
  }, [activeDescendantCandidate, items]);

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

  const isItemEnabled = (id: string) => {
    return items
      ? hasEnabledMetadataItem(items, id)
      : hasDomItem(containerRef.current, itemRole, containerRole, idPrefix, id, getItemId);
  };

  const activateItem = (next: string) => {
    setSelectedId(next);
    setHighlighted(next);
  };

  const handleItemActivate = (next: string) => {
    if (!isItemEnabled(next)) return;
    activateItem(next);
  };

  const handleItemEnter = (next: string, event: globalThis.KeyboardEvent) => {
    if (!isItemEnabled(next)) return;
    activateItem(next);
    onEnter?.(next, event);
  };

  const ensureActiveItem = useCallback(() => {
    if (activeDescendant !== null) return;
    const firstItemId = getFirstNavigableItemId(containerRef.current, itemRole, containerRole, items);
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

  const { onKeyDown: navKeyDown } = useNavigation({
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

    const query = readTypeaheadQuery(event.key);
    if (query === null) return;

    const typeaheadItems = getListboxItems(container, itemRole, containerRole, containerRole === "menu")
      .filter((item) => item.dataset.value !== undefined);
    if (typeaheadItems.length === 0) return;

    const currentValue = highlighted ?? selectedId;
    const currentIndex = currentValue === null
      ? -1
      : typeaheadItems.findIndex((item) => item.dataset.value === currentValue);

    const match = typeaheadSearch({
      items: typeaheadItems,
      query,
      currentIndex,
      getLabel: (item) => getAccessibleText(item).trim(),
    });

    if (match) {
      setHighlighted(match.dataset.value!);
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
    "aria-activedescendant": activeDescendant !== null
      ? getItemId(idPrefix, activeDescendant)
      : undefined,
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
