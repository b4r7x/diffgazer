import type { Shortcut } from "@diffgazer/core/schemas/ui";

export type {
  MenuAction,
  SettingsAction,
  NavItem,
  SettingsMenuItem,
} from "@diffgazer/core/schemas/ui";

export { MENU_ITEMS, SETTINGS_MENU_ITEMS } from "@diffgazer/core/schemas/ui";

export const MAIN_MENU_SHORTCUTS: Shortcut[] = [
  { key: "↑/↓", label: "Navigate" },
  { key: "Enter", label: "Select" },
  { key: "q", label: "Quit" },
];

export const SETTINGS_SHORTCUTS: Shortcut[] = [
  { key: "↑/↓", label: "Navigate" },
  { key: "Enter", label: "Edit" },
  { key: "Esc", label: "Back" },
];

export const REVIEW_SHORTCUTS: Shortcut[] = [
  { key: "j/k", label: "Navigate" },
  { key: "Tab", label: "Switch Pane" },
  { key: "1-4", label: "Switch Tab" },
  { key: "Esc", label: "Back" },
];
