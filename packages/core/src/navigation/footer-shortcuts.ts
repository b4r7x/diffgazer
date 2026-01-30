export interface FooterShortcut {
  key: string;
  label: string;
}

export const MAIN_MENU_SHORTCUTS: FooterShortcut[] = [
  { key: "↑/↓", label: "Select" },
  { key: "Enter", label: "Open" },
  { key: "q", label: "Quit" },
];

export const SETTINGS_SHORTCUTS: FooterShortcut[] = [
  { key: "↑/↓", label: "Select" },
  { key: "Enter", label: "Edit" },
  { key: "Esc", label: "Back" },
];
