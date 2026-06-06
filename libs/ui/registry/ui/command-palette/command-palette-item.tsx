"use client";

import { type ComponentPropsWithRef, type MouseEvent, type ReactNode, useId, useLayoutEffect, useRef } from "react";
import { composeRefs } from "@/lib/compose-refs";
import { useCommandPaletteContext } from "./command-palette-context";
import { getCommandPaletteItemDomId } from "./use-state";

export type CommandPaletteItemTone =
  | "neutral"
  | "nav"
  | "action"
  | "settings"
  | "destructive"
  | "ai";

export interface CommandPaletteItemProps
  extends Omit<ComponentPropsWithRef<"div">, "children" | "id" | "onSelect"> {
  id: string;
  value?: string;
  icon?: ReactNode;
  shortcut?: string;
  tone?: CommandPaletteItemTone;
  onSelect?: () => void;
  disabled?: boolean;
  children: ReactNode;
}

export function CommandPaletteItem({
  id,
  value,
  icon,
  shortcut,
  tone = "neutral",
  onSelect,
  disabled = false,
  children,
  className,
  ref,
  onClick,
  onMouseMove,
  ...props
}: CommandPaletteItemProps) {
  const {
    highlighted,
    onHighlightChange,
    onActivate,
    search,
    shouldFilter,
    filter,
    listId,
    registerItem,
    unregisterItem,
  } = useCommandPaletteContext();
  const registrationId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  const searchValue = value ?? id;
  const isVisible = !shouldFilter || !search || filter(searchValue, search);

  useLayoutEffect(() => {
    registerItem({
      registrationId,
      id,
      value: searchValue,
      disabled: disabled || !isVisible,
      onSelect: disabled ? undefined : onSelect,
      element: isVisible ? rootRef.current : null,
    });
    return () => unregisterItem(registrationId);
  }, [disabled, id, isVisible, onSelect, registerItem, registrationId, searchValue, unregisterItem]);

  if (!isVisible) return null;

  const isHighlighted = highlighted === id;

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    onClick?.(event);
    if (!event.defaultPrevented && !disabled) onActivate(id);
  };

  const handleMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    onMouseMove?.(event);
    if (event.defaultPrevented || disabled) return;
    if (highlighted !== id) onHighlightChange(id);
  };

  return (
    // biome-ignore lint/a11y/useFocusableInteractive: WAI-ARIA combobox/listbox pattern — option stays non-focusable while the input keeps focus and aria-activedescendant tracks the active option.
    // biome-ignore lint/a11y/useKeyWithClickEvents: Enter activation is handled centrally by the command palette input, not per option.
    <div
      {...props}
      ref={composeRefs(rootRef, ref)}
      id={getCommandPaletteItemDomId(listId, id)}
      role="option"
      data-slot="command-palette-item"
      data-value={id}
      data-tone={tone}
      aria-selected={isHighlighted}
      aria-disabled={disabled || undefined}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      className={className}
    >
      {icon !== undefined && (
        <span data-slot="command-palette-item-icon">{icon}</span>
      )}
      <span data-slot="command-palette-item-label">{children}</span>
      {shortcut ? (
        <span data-slot="command-palette-item-shortcut">{shortcut}</span>
      ) : null}
    </div>
  );
}
