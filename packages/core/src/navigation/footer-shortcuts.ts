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

export const HISTORY_SHORTCUTS: FooterShortcut[] = [
  { key: "Tab", label: "Switch Focus" },
  { key: "Enter", label: "Expand" },
  { key: "o", label: "Open" },
  { key: "Esc", label: "Back" },
];

export const HISTORY_RIGHT_SHORTCUTS: FooterShortcut[] = [
  { key: "r", label: "Resume" },
  { key: "e", label: "Export" },
];

export const REVIEW_SHORTCUTS: FooterShortcut[] = [
  { key: "j/k", label: "Select" },
  { key: "←/→", label: "Navigate" },
  { key: "1-4", label: "Tab" },
];

export const REVIEW_RIGHT_SHORTCUTS: FooterShortcut[] = [
  { key: "Space", label: "Toggle" },
  { key: "Esc", label: "Back" },
];

export const REVIEW_SUMMARY_SHORTCUTS: FooterShortcut[] = [
  { key: "Enter", label: "Start Review" },
];

export const REVIEW_SUMMARY_RIGHT_SHORTCUTS: FooterShortcut[] = [
  { key: "Esc", label: "Back" },
];

export const SETTINGS_HUB_SHORTCUTS: FooterShortcut[] = [
  { key: "1-4", label: "Jump" },
  { key: "j/k", label: "Navigate" },
  { key: "Enter", label: "Select" },
  { key: "b", label: "Back" },
];
