/**
 * Where a shortcut applies. Only the help tables tag their entries; footers and
 * menu constants leave it undefined and ignore the field entirely.
 */
export type ShortcutContext = "global" | "list" | "review" | "history";

export interface Shortcut {
  key: string;
  label: string;
  disabled?: boolean;
  context?: ShortcutContext;
}

export const SHORTCUT_CONTEXT_ORDER = ["global", "list", "review", "history"] as const;

export const SHORTCUT_CONTEXT_LABELS: Record<ShortcutContext, string> = {
  global: "Anywhere",
  list: "In lists",
  review: "In a review",
  history: "In history",
};

export interface ShortcutGroup {
  context: ShortcutContext;
  shortcuts: Shortcut[];
}

/**
 * Groups a help table by context in the canonical order. Untagged entries fall
 * into "global", empty groups are omitted, and order is preserved within a
 * group so both surfaces render the same sequence.
 */
export function groupShortcutsByContext(shortcuts: readonly Shortcut[]): ShortcutGroup[] {
  const byContext = new Map<ShortcutContext, Shortcut[]>();

  for (const shortcut of shortcuts) {
    const context = shortcut.context ?? "global";
    const existing = byContext.get(context);
    if (existing) existing.push(shortcut);
    else byContext.set(context, [shortcut]);
  }

  return SHORTCUT_CONTEXT_ORDER.flatMap((context) => {
    const group = byContext.get(context);
    return group ? [{ context, shortcuts: group }] : [];
  });
}

export function areShortcutsEqual(a: Shortcut[], b: Shortcut[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;

  return a.every((left, index) => {
    const right = b[index];
    return (
      right !== undefined &&
      left.key === right.key &&
      left.label === right.label &&
      left.disabled === right.disabled &&
      left.context === right.context
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

export const BACK_SHORTCUT: Shortcut = { key: "Esc", label: "Back" };
export const SWITCH_PANE_SHORTCUT: Shortcut = { key: "Tab", label: "Switch Pane" };
export const NAVIGATE_SHORTCUT: Shortcut = { key: "↑/↓", label: "Navigate" };
export const BACK_SHORTCUTS: Shortcut[] = [BACK_SHORTCUT];

// Canonical help-screen shortcut table, consumed by both surfaces' Help screens.
// Every entry has a live handler on at least one surface (web: q/s/h/shift+?,
// list/menu navigation, `/` history search; TUI: q/s/?, `/` history search).
// Entries are tagged with the context they apply in and grouped at render time;
// the shared footer constants are spread rather than mutated so `context` never
// leaks into footer rendering.
export const HELP_SHORTCUTS: Shortcut[] = [
  { key: "Enter", label: "Select / Confirm", context: "global" },
  { key: "Esc", label: "Go Back", context: "global" },
  { key: "s", label: "Open Settings", context: "global" },
  { key: "?", label: "Open Help", context: "global" },
  { key: "q", label: "Quit", context: "global" },
  { key: "↑/↓", label: "Move the highlight", context: "list" },
  { key: "j/k", label: "Move the highlight", context: "list" },
  { ...SWITCH_PANE_SHORTCUT, context: "review" },
  { key: "1-4", label: "Switch Tab", context: "review" },
  { key: "↑/↓", label: "Scroll the focused pane", context: "review" },
  { key: "PgUp/PgDn", label: "Page up or down", context: "review" },
  { key: "Home/End", label: "Jump to start or end", context: "review" },
  { key: "/", label: "Search Runs", context: "history" },
];

// Both surfaces consume the permission entries; Tab and q are TUI-home shortcuts.
export const TRUST_FOOTER_SHORTCUTS: Shortcut[] = [
  { key: "↑/↓", label: "Navigate Permissions" },
  { key: "Enter/Space", label: "Toggle" },
  { key: "Tab", label: "Focus Actions" },
  { key: "q", label: "Quit" },
];

export const TRUST_FOOTER_RIGHT_SHORTCUTS: Shortcut[] = [
  { key: "s", label: "Settings" },
  { key: "?", label: "Help" },
];
