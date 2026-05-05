import type { Shortcut } from "@diffgazer/core/schemas/ui";

export type {
  MenuAction,
  SettingsAction,
  NavItem,
  SettingsMenuItem,
} from "@diffgazer/core/schemas/ui";

export { MENU_ITEMS, SETTINGS_MENU_ITEMS } from "@diffgazer/core/schemas/ui";

export const MAIN_MENU_SHORTCUTS: Shortcut[] = [
  { key: "↑/↓", label: "Select" },
  { key: "Enter", label: "Open" },
  { key: "q", label: "Quit" },
];

export const SETTINGS_SHORTCUTS: Shortcut[] = [
  { key: "↑/↓", label: "Select" },
  { key: "Enter", label: "Edit" },
  { key: "Esc", label: "Back" },
];
