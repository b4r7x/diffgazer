export type AppContext = "cli" | "web";

export type MenuAction =
  | "review-unstaged"
  | "review-staged"
  | "review-files"
  | "resume-review"
  | "history"
  | "open-web"
  | "settings"
  | "help"
  | "quit";

export interface MenuItem {
  id: MenuAction;
  label: string;
  shortcut?: string;
  variant?: "default" | "danger";
  group: "review" | "navigation" | "system";
  contexts?: AppContext[];
}

export const MENU_ITEMS: MenuItem[] = [
  { id: "review-unstaged", label: "Review Unstaged", shortcut: "r", group: "review" },
  { id: "review-staged", label: "Review Staged", shortcut: "R", group: "review" },
  { id: "review-files", label: "Review Files...", shortcut: "f", group: "review" },
  { id: "resume-review", label: "Resume Last Review", shortcut: "l", group: "review" },
  { id: "history", label: "History", shortcut: "h", group: "navigation" },
  { id: "open-web", label: "Open Web UI", shortcut: "w", group: "navigation", contexts: ["cli"] },
  { id: "settings", label: "Settings", shortcut: "s", group: "navigation" },
  { id: "help", label: "Help", shortcut: "?", group: "system" },
  { id: "quit", label: "Quit", shortcut: "q", variant: "danger", group: "system" },
];

export function getMenuItemsForContext(context: AppContext): MenuItem[] {
  return MENU_ITEMS.filter((item) => !item.contexts || item.contexts.includes(context));
}
