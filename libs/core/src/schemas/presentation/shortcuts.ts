import { z } from "zod";

const ShortcutSchema = z.object({
  key: z.string(),
  label: z.string(),
  disabled: z.boolean().optional(),
});
export type Shortcut = z.infer<typeof ShortcutSchema>;

export function areShortcutsEqual(a: Shortcut[], b: Shortcut[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;

  return a.every((left, index) => {
    const right = b[index];
    return (
      right !== undefined &&
      left.key === right.key &&
      left.label === right.label &&
      left.disabled === right.disabled
    );
  });
}

// "Navigate"/"Select"/"Quit" matches the rest of the keyboard model
// (`j/k Navigate` in review, `Enter Select` everywhere else). Both web and CLI
// consume this single constant.
export const MAIN_MENU_SHORTCUTS: Shortcut[] = [
  { key: "↑/↓", label: "Navigate" },
  { key: "Enter", label: "Select" },
  { key: "q", label: "Quit" },
];

// Shared settings-hub footer shortcuts consumed by both the web and CLI hubs.
export const SETTINGS_SHORTCUTS: Shortcut[] = [
  { key: "↑/↓", label: "Navigate" },
  { key: "Enter", label: "Edit" },
  { key: "Esc", label: "Back" },
];

// The two most common footer fragments, previously re-typed inline across both
// surfaces. Both web and CLI consume these single constants.
export const BACK_SHORTCUT: Shortcut = { key: "Esc", label: "Back" };
export const NAVIGATE_SHORTCUT: Shortcut = { key: "↑/↓", label: "Navigate" };
export const BACK_SHORTCUTS: Shortcut[] = [BACK_SHORTCUT];

// Canonical help-screen shortcut table, consumed by both surfaces' Help screens.
// Every entry has a live handler on at least one surface (web: q/s/h/shift+?,
// list/menu navigation; TUI: q/s/?).
export const HELP_SHORTCUTS: Shortcut[] = [
  { key: "↑/↓", label: "Navigate Menus and Lists" },
  { key: "Enter", label: "Select / Confirm" },
  { key: "Esc", label: "Go Back" },
  { key: "Tab", label: "Switch Pane" },
  { key: "1-4", label: "Switch Tab (in Review)" },
  { key: "j/k", label: "Scroll Content" },
  { key: "s", label: "Open Settings" },
  { key: "q", label: "Quit" },
  { key: "?", label: "Open Help" },
];

// Trust-panel footer shortcuts consumed by both surfaces' home trust prompt.
export const TRUST_FOOTER_SHORTCUTS: Shortcut[] = [
  { key: "↑/↓", label: "Navigate Permissions" },
  { key: "Enter/Space", label: "Toggle Permission" },
  { key: "q", label: "Quit" },
];

export const TRUST_FOOTER_RIGHT_SHORTCUTS: Shortcut[] = [
  { key: "s", label: "Settings" },
  { key: "?", label: "Help" },
];
