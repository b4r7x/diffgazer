"use client";

import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState, type KeyboardEvent, type Ref } from "react";
import { useNavigation, type NavigationRole } from "@/hooks/use-navigation";
import { useControllableState } from "@/hooks/use-controllable-state";
import { composeRefs } from "@/lib/compose-refs";

export interface UseListboxOptions {
  selectedId?: string | null;
  defaultSelectedId?: string | null;
  highlightedId?: string | null;
  defaultHighlightedId?: string | null;
  onSelect?: (id: string) => void;
  onHighlightChange?: (id: string) => void;
  wrap?: boolean;
  idPrefix: string;
  onKeyDown?: (event: KeyboardEvent) => void;
  role?: "listbox" | "menu";
  itemRole?: Extract<NavigationRole, "option" | "menuitem" | "menuitemradio">;
  typeahead?: boolean;
  items?: Array<{ id: string; disabled?: boolean }>;
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

const TYPEAHEAD_RESET_MS = 500;

export function getEncodedListboxItemId(idPrefix: string, id: string): string {
  return `${idPrefix}-${encodeURIComponent(id)}`;
}

function hasEnabledItem(
  container: HTMLElement | null,
  itemRole: string,
  idPrefix: string,
  id: string | null,
  getItemId: (idPrefix: string, id: string) => string,
): id is string {
  if (!container || id === null) return false;
  const element = container.ownerDocument.getElementById(getItemId(idPrefix, id));
  return Boolean(
    element &&
      element.getAttribute("role") === itemRole &&
      element.dataset.value === id &&
      element.getAttribute("aria-disabled") !== "true" &&
      !element.hasAttribute("data-disabled"),
  );
}

function hasEnabledMetadataItem(
  items: Array<{ id: string; disabled?: boolean }>,
  id: string | null,
): id is string {
  return id !== null && items.some((item) => item.id === id && !item.disabled);
}

function resolveActiveDescendant(
  items: Array<{ id: string; disabled?: boolean }> | undefined,
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

export function useListbox({
  selectedId: controlledSelectedId,
  defaultSelectedId = null,
  highlightedId: controlledHighlightedId,
  defaultHighlightedId = null,
  onSelect,
  onHighlightChange,
  wrap = true,
  idPrefix,
  onKeyDown,
  role: containerRole = "listbox",
  itemRole = "option",
  typeahead = false,
  items,
  getItemId = getEncodedListboxItemId,
}: UseListboxOptions): UseListboxReturn {
  const containerRef = useRef<HTMLDivElement>(null);
  const typeaheadBuffer = useRef("");
  const typeaheadTimer = useRef<number>(0);
  const [domActiveDescendant, setDomActiveDescendant] = useState<string | null>(null);

  useEffect(() => () => clearTimeout(typeaheadTimer.current), []);

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
    const next = hasEnabledItem(containerRef.current, itemRole, idPrefix, activeDescendantCandidate, getItemId)
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
  }, [getItemId, idPrefix, itemRole, items]);

  const handleItemActivate = (next: string) => {
    const enabled = items
      ? hasEnabledMetadataItem(items, next)
      : hasEnabledItem(containerRef.current, itemRole, idPrefix, next, getItemId);
    if (!enabled) return;
    setSelectedId(next);
    setHighlightedId(next);
  };

  const { onKeyDown: navKeyDown } = useNavigation({
    containerRef,
    role: itemRole,
    wrap,
    value: highlightedId ?? selectedId ?? undefined,
    onValueChange: setHighlightedId,
    onEnter: handleItemActivate,
    onSelect: handleItemActivate,
  });

  const handleTypeahead = (key: string): void => {
    if (!typeahead || key.length !== 1 || key === " ") return;
    clearTimeout(typeaheadTimer.current);
    typeaheadBuffer.current += key;
    typeaheadTimer.current = window.setTimeout(() => {
      typeaheadBuffer.current = "";
    }, TYPEAHEAD_RESET_MS);

    const query = typeaheadBuffer.current.toLowerCase();
    const items = containerRef.current?.querySelectorAll<HTMLElement>(
      `[role="${itemRole}"]:not([aria-disabled="true"])`,
    );
    if (!items) return;
    for (const item of items) {
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
