"use client";

import { type CommandPaletteProps, CommandPalette as CommandPaletteRoot } from "./command-palette";
import {
  CommandPaletteContent,
  type CommandPaletteContentProps,
  type CommandPaletteDensity,
  type CommandPaletteFrame,
  commandPaletteContentVariants,
} from "./command-palette-content";
import { CommandPaletteEmpty, type CommandPaletteEmptyProps } from "./command-palette-empty";
import { CommandPaletteFooter, type CommandPaletteFooterProps } from "./command-palette-footer";
import { CommandPaletteGroup, type CommandPaletteGroupProps } from "./command-palette-group";
import { CommandPaletteInput, type CommandPaletteInputProps } from "./command-palette-input";
import {
  CommandPaletteItem,
  type CommandPaletteItemProps,
  type CommandPaletteItemTone,
} from "./command-palette-item";
import { CommandPaletteList, type CommandPaletteListProps } from "./command-palette-list";

/**
 * Terminal-styled command palette with built-in search filtering, grouped items, and keyboard
 * navigation. Uses native dialog element with backdrop blur. Two orthogonal visual axes on
 * Content (frame and density) keep visual chrome configurable without touching internals.
 */
const CommandPalette = Object.assign(CommandPaletteRoot, {
  Content: CommandPaletteContent,
  Input: CommandPaletteInput,
  List: CommandPaletteList,
  Group: CommandPaletteGroup,
  Item: CommandPaletteItem,
  Empty: CommandPaletteEmpty,
  Footer: CommandPaletteFooter,
});

export { CommandPalette, type CommandPaletteProps };
export {
  CommandPaletteContent,
  commandPaletteContentVariants,
  type CommandPaletteContentProps,
  type CommandPaletteFrame,
  type CommandPaletteDensity,
};
export { CommandPaletteInput, type CommandPaletteInputProps };
export { CommandPaletteList, type CommandPaletteListProps };
export { CommandPaletteGroup, type CommandPaletteGroupProps };
export { CommandPaletteItem, type CommandPaletteItemProps, type CommandPaletteItemTone };
export { CommandPaletteEmpty, type CommandPaletteEmptyProps };
export { CommandPaletteFooter, type CommandPaletteFooterProps };
