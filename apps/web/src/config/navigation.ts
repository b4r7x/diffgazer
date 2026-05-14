import type { Shortcut } from "@diffgazer/core/schemas/ui";

export type {
  MenuAction,
  SettingsAction,
  NavItem,
  SettingsMenuItem,
} from "@diffgazer/core/schemas/ui";

export {
  MENU_ITEMS,
  SETTINGS_MENU_ITEMS,
  MAIN_MENU_SHORTCUTS,
} from "@diffgazer/core/schemas/ui";

export const SETTINGS_SHORTCUTS: Shortcut[] = [
  { key: "↑/↓", label: "Navigate" },
  { key: "Enter", label: "Edit" },
  { key: "Esc", label: "Back" },
];
