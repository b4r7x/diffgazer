"use client";

import { Children, isValidElement, useMemo, type ReactNode } from "react";
import {
  useCommandPaletteState,
  type CommandPaletteItemMetadata,
  type UseCommandPaletteStateOptions,
} from "./use-command-palette-state";
import { CommandPaletteContext } from "./command-palette-context";
import { CommandPaletteItem, type CommandPaletteItemProps } from "./command-palette-item";

export interface CommandPaletteProps extends Omit<UseCommandPaletteStateOptions, "items"> {
  children: ReactNode;
}

export function CommandPalette({
  children,
  ...stateProps
}: CommandPaletteProps) {
  const items = useMemo(() => collectCommandItems(children), [children]);
  const contextValue = useCommandPaletteState({ ...stateProps, items });

  return (
    <CommandPaletteContext value={contextValue}>
      {children}
    </CommandPaletteContext>
  );
}

function collectCommandItems(children: ReactNode): readonly CommandPaletteItemMetadata[] {
  const items: CommandPaletteItemMetadata[] = [];

  Children.forEach(children, (child) => {
    if (!isValidElement<{ children?: ReactNode }>(child)) return;

    if (child.type === CommandPaletteItem) {
      const props = child.props as CommandPaletteItemProps;
      items.push({
        id: props.id,
        value: props.value ?? props.id,
        disabled: props.disabled ?? false,
        onSelect: props.disabled ? undefined : props.onSelect,
      });
      return;
    }

    items.push(...collectCommandItems(child.props.children));
  });

  return items;
}
