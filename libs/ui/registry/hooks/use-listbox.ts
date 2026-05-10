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
  highlightedId?: string | null;
  defaultHighlightedId?: string | null;
  onSelect?: (id: string) => void;
  onEnter?: (id: string, event: globalThis.KeyboardEvent) => void;
  onHighlightChange?: (id: string) => void;
  onNavigationBoundaryReached?: (direction: "previous" | "next") => void;
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
  highlightedId: string | null;
  handleItemHighlight: (id: string) => void;
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

function hasEnabledItem(
  container: HTMLElement | null,
  itemRole: string,
  containerRole: "listbox" | "menu",
  idPrefix: string,
  id: string | null,
  getItemId: (idPrefix: string, id: string) => string,
): id is string {
  if (!container || id === null) return false;
  const element = container.ownerDocument.getElementById(getItemId(idPrefix, id));
  return Boolean(
    element &&
      container.contains(element) &&
      isOwnedListboxItem(element, container, containerRole) &&
      element.getAttribute("role") === itemRole &&
      element.dataset.value === id &&
      element.getAttribute("aria-disabled") !== "true" &&
      !element.hasAttribute("data-disabled"),
  );
}

function hasEnabledMetadataItem(
  items: ListboxMetadataItem[],
  id: string | null,
): id is string {
  return id !== null && items.some((item) => item.id === id && !item.disabled);
}

function resolveActiveDescendant(
  items: ListboxMetadataItem[] | undefined,
  highlightedId: string | null,
  selectedId: string | null,
): string | null {
  if (!items) return highlightedId ?? selectedId;
  if (hasEnabledMetadataItem(items, highlightedId)) return highlightedId;
  if (hasEnabledMetadataItem(items, selectedId)) return selectedId;
  return null;
}

function getAccessibleText(el: HTMLElement): string {
  let text = "";
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const child = node as HTMLElement;
      if (child.getAttribute("aria-hidden") !== "true") {
        text += getAccessibleText(child);
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

function getEnabledListboxItems(
  container: HTMLElement | null,
  itemRole: string,
  containerRole: "listbox" | "menu",
) {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>(
    `[role="${itemRole}"]:not([aria-disabled="true"]):not([data-disabled])`,
  )).filter((item) => isOwnedListboxItem(item, container, containerRole));
}

function getFirstEnabledItemId(
  container: HTMLElement | null,
  itemRole: string,
  containerRole: "listbox" | "menu",
  items?: ListboxMetadataItem[],
): string | null {
  if (items) return items.find((item) => !item.disabled)?.id ?? null;

  const firstEnabledItem = getEnabledListboxItems(container, itemRole, containerRole)[0];
  return firstEnabledItem?.dataset.value !== undefined ? firstEnabledItem.dataset.value : null;
}

export function useListbox({
  selectedId: controlledSelectedId,
  defaultSelectedId = null,
  highlightedId: controlledHighlightedId,
  defaultHighlightedId = null,
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

  const [highlightedId, setHighlightedId] = useControllableState<string | null>({
    value: controlledHighlightedId,
    defaultValue: defaultHighlightedId,
    onChange: (next) => {
      if (next !== null) onHighlightChange?.(next);
    },
  });

  const activeDescendantCandidate = resolveActiveDescendant(items, highlightedId, selectedId);
  const activeDescendant = items ? activeDescendantCandidate : domActiveDescendant;

  const syncDomActiveDescendant = useEffectEvent(() => {
    if (items) return;
    const next = hasEnabledItem(containerRef.current, itemRole, containerRole, idPrefix, activeDescendantCandidate, getItemId)
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
      : hasEnabledItem(containerRef.current, itemRole, containerRole, idPrefix, id, getItemId);
  };

  const activateItem = (next: string) => {
    setSelectedId(next);
    setHighlightedId(next);
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
    const firstEnabledId = getFirstEnabledItemId(containerRef.current, itemRole, containerRole, items);
    if (firstEnabledId !== null) setHighlightedId(firstEnabledId);
  }, [activeDescendant, containerRole, itemRole, items, setHighlightedId]);

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
    highlighted: highlightedId ?? selectedId ?? undefined,
    onHighlightChange: setHighlightedId,
    onEnter: handleItemEnter,
    onSelect: handleItemActivate,
    onNavigationBoundaryReached,
    scopeToContainer: true,
  });

  const handleTypeahead = (key: string): void => {
    if (!typeahead) return;

    const query = readTypeaheadQuery(key);
    if (query === null) return;

    const enabledItems = getEnabledListboxItems(containerRef.current, itemRole, containerRole);
    for (const item of enabledItems) {
      const label = getAccessibleText(item).trim().toLowerCase();
      if (label.startsWith(query) && item.dataset.value !== undefined) {
        setHighlightedId(item.dataset.value);
        item.scrollIntoView?.({ block: "nearest" });
        break;
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e);
    if (!e.defaultPrevented) {
      navKeyDown(e);
      if (!e.ctrlKey && !e.metaKey && !e.altKey) handleTypeahead(e.key);
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
    highlightedId,
    handleItemHighlight: setHighlightedId,
    handleItemActivate,
    getContainerProps,
  };
}
