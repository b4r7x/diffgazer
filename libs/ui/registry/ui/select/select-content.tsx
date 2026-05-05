"use client";

import { useEffectEvent, useLayoutEffect, useRef, type ReactNode, type KeyboardEvent, type Ref, type RefObject } from "react";
import { useNavigation } from "@/hooks/use-navigation";
import { usePresence } from "@/hooks/use-presence";
import { useFloatingPosition, type FloatingSide, type FloatingAlign } from "@/hooks/use-floating-position";
import { composeRefs } from "@/lib/compose-refs";
import { cn } from "@/lib/utils";
import { Portal } from "../shared/portal";
import { useSelectContext } from "./select-context";
import { matchesSearch } from "@/lib/search";
import { toOptionId } from "./select-utils";

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

const NAV_KEYS = new Set(["ArrowUp", "ArrowDown", "Enter", "Home", "End"]);
const TYPEAHEAD_RESET_MS = 500;

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
    onHighlight,
    onOpenChange,
    selectItem,
    listboxId,
    triggerId,
    searchInputRef,
    triggerRef,
    labelsRef,
    searchQuery,
  } = useSelectContext("SelectContent");
  const containerRef = useRef<HTMLDivElement>(null);
  const isDropdown = variant !== "card";

  const { onKeyDown: navKeyDown } = useNavigation({
    containerRef,
    role: "option",
    wrap: true,
    value: highlighted,
    onValueChange: onHighlight,
    onSelect: selectItem,
    enabled: open,
  });

  const typeaheadBuffer = useRef("");
  const typeaheadTimer = useRef<number>(0);

  function handleTypeahead(key: string): void {
    if (key.length !== 1 || key === " ") return;
    clearTimeout(typeaheadTimer.current);
    typeaheadBuffer.current += key;
    typeaheadTimer.current = window.setTimeout(() => {
      typeaheadBuffer.current = "";
    }, TYPEAHEAD_RESET_MS);

    const query = typeaheadBuffer.current.toLowerCase();
    for (const [itemValue, label] of labelsRef.current) {
      if (label.toLowerCase().startsWith(query)) {
        onHighlight(itemValue);
        break;
      }
    }
  }

  const { present, onAnimationEnd } = usePresence({ open: isDropdown && open, ref: containerRef });
  const { position, contentRef } = useFloatingPosition({
    triggerRef,
    open: isDropdown && present,
    side,
    align,
    sideOffset,
    alignOffset: 0,
    collisionPadding,
    avoidCollisions: true,
  });

  const initHighlight = useEffectEvent(() => {
    if (highlighted) return;
    const selectedValues = Array.isArray(value) ? value : value ? [value] : [];
    if (selectedValues[0]) {
      onHighlight(selectedValues[0]);
      return;
    }
    const firstOption = containerRef.current?.querySelector<HTMLElement>(
      '[role="option"]:not([aria-disabled="true"])',
    );
    if (firstOption?.dataset.value) {
      onHighlight(firstOption.dataset.value);
    }
  });

  const triggerWidthRef = useRef<number | undefined>(undefined);

  useLayoutEffect(() => {
    if (!open) return;
    if (isDropdown) {
      triggerWidthRef.current = triggerRef.current?.getBoundingClientRect().width;
    }
    if (!searchInputRef.current) {
      containerRef.current?.focus();
    }
    initHighlight();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- searchInputRef/triggerRef are stable refs
  }, [open]);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onOpenChange(false);
      triggerRef.current?.focus();
      return;
    }

    if (e.key === "Tab") {
      if (highlighted && !multiple) selectItem(highlighted);
      onOpenChange(false);
      return;
    }

    const isTyping = e.target === searchInputRef.current;
    if (isTyping) {
      if (NAV_KEYS.has(e.key)) navKeyDown(e);
    } else {
      navKeyDown(e);
      if (!e.ctrlKey && !e.metaKey && !e.altKey) handleTypeahead(e.key);
    }

    onKeyDown?.(e);
  };

  const listboxProps = {
    id: listboxId,
    role: "listbox" as const,
    tabIndex: -1,
    "aria-multiselectable": multiple || undefined,
    "aria-activedescendant": !searchInputRef.current && highlighted ? toOptionId(listboxId, highlighted) : undefined,
    "aria-labelledby": triggerId,
    onKeyDown: handleKeyDown,
  };

  if (!isDropdown) {
    return (
      <div
        {...listboxProps}
        ref={composeRefs(containerRef, ref)}
        hidden={!open}
        className={cn("w-full overflow-hidden p-1 space-y-0.5 outline-none", className)}
      >
        {children}
        {searchQuery && <MatchCount labelsRef={labelsRef} searchQuery={searchQuery} />}
      </div>
    );
  }

  if (!present) return null;

  return (
    <Portal>
      <div
        {...listboxProps}
        ref={composeRefs(containerRef, contentRef, ref)}
        data-state={open ? "open" : "closed"}
        data-side={position?.side}
        onAnimationEnd={onAnimationEnd}
        className={cn(
          "fixed z-9999 border border-border bg-background shadow-2xl rounded-sm overflow-hidden outline-none",
          "data-[state=open]:animate-slide-in",
          "data-[state=closed]:animate-slide-out",
          className,
        )}
        style={
          position
            ? { top: position.y, left: position.x, width: triggerWidthRef.current }
            : { visibility: "hidden" as const, position: "fixed" as const, top: 0, left: 0 }
        }
      >
        {children}
        {searchQuery && <MatchCount labelsRef={labelsRef} searchQuery={searchQuery} />}
      </div>
    </Portal>
  );
}

function MatchCount({ labelsRef, searchQuery }: { labelsRef: RefObject<Map<string, string>>; searchQuery: string }) {
  let count = 0;
  for (const label of labelsRef.current.values()) {
    if (matchesSearch(label, searchQuery)) count++;
  }
  return (
    <div role="status" aria-live="polite" className="sr-only">
      {count} results
    </div>
  );
}
