"use client";

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type Ref } from "react";
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

function hasEnabledItem(container: HTMLElement | null, itemRole: string, idPrefix: string, id: string | null): id is string {
  if (!container || !id) return false;
  const element = container.ownerDocument.getElementById(`${idPrefix}-${id}`);
  return Boolean(
    element &&
      element.getAttribute("role") === itemRole &&
      element.dataset.value === id &&
      element.getAttribute("aria-disabled") !== "true" &&
      !element.hasAttribute("data-disabled"),
  );
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
}: UseListboxOptions): UseListboxReturn {
  const containerRef = useRef<HTMLDivElement>(null);
  const typeaheadBuffer = useRef("");
  const typeaheadTimer = useRef<number>(0);
  const [, forceActiveDescendantCheck] = useState(0);

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

  const handleItemActivate = (next: string) => {
    setSelectedId(next);
    setHighlightedId(next);
  };

  const { onKeyDown: navKeyDown } = useNavigation({
    containerRef,
    role: itemRole,
    wrap,
    value: highlightedId ?? undefined,
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
      if (label.startsWith(query) && item.dataset.value) {
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

  const activeDescendant = hasEnabledItem(containerRef.current, itemRole, idPrefix, highlightedId)
    ? highlightedId
    : hasEnabledItem(containerRef.current, itemRole, idPrefix, selectedId)
      ? selectedId
      : null;

  useLayoutEffect(() => {
    const nextActiveDescendant = hasEnabledItem(containerRef.current, itemRole, idPrefix, highlightedId)
      ? highlightedId
      : hasEnabledItem(containerRef.current, itemRole, idPrefix, selectedId)
        ? selectedId
        : null;

    if (nextActiveDescendant !== activeDescendant) {
      forceActiveDescendantCheck((current) => current + 1);
    }
  });

  const getContainerProps = (ref?: Ref<HTMLDivElement>) => ({
    ref: composeRefs(containerRef, ref),
    role: containerRole,
    tabIndex: 0 as const,
    "aria-activedescendant": activeDescendant
      ? `${idPrefix}-${activeDescendant}`
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
