import { CommandPalette as CommandPaletteRoot, type CommandPaletteProps } from "./command-palette";
import { CommandPaletteContent, type CommandPaletteContentProps } from "./command-palette-content";
import { CommandPaletteInput, type CommandPaletteInputProps } from "./command-palette-input";
import { CommandPaletteList, type CommandPaletteListProps } from "./command-palette-list";
import { CommandPaletteGroup, type CommandPaletteGroupProps } from "./command-palette-group";
import { CommandPaletteFooter, type CommandPaletteFooterProps } from "./command-palette-footer";
import { CommandPaletteItem, type CommandPaletteItemProps } from "./command-palette-item";
import { CommandPaletteEmpty, type CommandPaletteEmptyProps } from "./command-palette-empty";

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
export { CommandPaletteContent, type CommandPaletteContentProps };
export { CommandPaletteInput, type CommandPaletteInputProps };
export { CommandPaletteList, type CommandPaletteListProps };
export { CommandPaletteGroup, type CommandPaletteGroupProps };
export { CommandPaletteItem, type CommandPaletteItemProps };
export { CommandPaletteEmpty, type CommandPaletteEmptyProps };
export { CommandPaletteFooter, type CommandPaletteFooterProps };
