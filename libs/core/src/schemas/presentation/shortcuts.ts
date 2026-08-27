/**
 * The canonical render order, and the authority for which contexts exist: a
 * context absent from this list would be dropped by `groupShortcutsByContext`,
 * so the union is derived from it rather than declared beside it.
 */
const SHORTCUT_CONTEXT_ORDER = [
  "global",
  "list",
  "home",
  "providers",
  "review",
  "history",
] as const;

/**
 * Where a shortcut applies. Only the help tables tag their entries; footers and
 * menu constants leave it undefined and ignore the field entirely.
 */
export type ShortcutContext = (typeof SHORTCUT_CONTEXT_ORDER)[number];

export interface Shortcut {
  key: string;
  label: string;
  disabled?: boolean;
  context?: ShortcutContext;
}

/** A help-table row. Its context is what groups it, so it is never optional. */
type ContextualShortcut = Shortcut & { context: ShortcutContext };

export const SHORTCUT_CONTEXT_LABELS: Record<ShortcutContext, string> = {
  global: "Anywhere",
  list: "In lists",
  home: "On the home screen",
  providers: "On the Providers page",
  review: "In a review",
  history: "In history",
};

interface ShortcutGroup {
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
// (`↑/↓ Navigate` in review, `Enter Select` everywhere else). Both web and CLI
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

// The providers More menu owns the keys while it is open, on both surfaces.
export const PROVIDER_ACTIONS_MENU_SHORTCUTS: Shortcut[] = [
  NAVIGATE_SHORTCUT,
  { key: "Enter", label: "Run" },
];
export const PROVIDER_ACTIONS_MENU_RIGHT_SHORTCUTS: Shortcut[] = [
  { ...BACK_SHORTCUT, label: "Close" },
];

// Reopens the provider data notice from the Providers page while it is still to
// be accepted; the details pane on both surfaces teaches it beside its status.
export const REVIEW_CONSENT_SHORTCUT: Shortcut = { key: "c", label: "Review" };

// Canonical help-screen shortcut table, consumed by both surfaces' Help screens.
// Every entry has a live handler on at least one surface (web: q/s/h/shift+?,
// list/menu navigation, `/` history search; TUI: q/s/?, `/` history search).
// The history l/R entries are bound on both surfaces; they read the same there
// as on the home screen's r/R/f/l, which are menu items rather than list actions.
// The home entries are the r/R/f/l menu bindings both surfaces resolve through
// MENU_ITEMS; the providers entries are the m/e/v/d accelerators both surfaces
// resolve through PROVIDER_ACTION_HOTKEYS, plus REVIEW_CONSENT_SHORTCUT.
// Entries are tagged with the context they apply in and grouped at render time;
// the shared footer constants are spread rather than mutated so `context` never
// leaks into footer rendering.
export const HELP_SHORTCUTS: ContextualShortcut[] = [
  { key: "Enter", label: "Select / Confirm", context: "global" },
  { key: "Esc", label: "Go Back", context: "global" },
  { key: "s", label: "Open Settings", context: "global" },
  { key: "?", label: "Open Help", context: "global" },
  { key: "q", label: "Quit", context: "global" },
  { key: "↑/↓", label: "Move the highlight", context: "list" },
  { key: "j/k", label: "Move the highlight", context: "list" },
  { key: "r", label: "Review Unstaged", context: "home" },
  { key: "R", label: "Review Staged", context: "home" },
  { key: "f", label: "Review Specific Files", context: "home" },
  { key: "l", label: "Resume Last Review", context: "home" },
  { key: "m", label: "Change model", context: "providers" },
  { key: "e", label: "Update configuration", context: "providers" },
  { key: "v", label: "Verify", context: "providers" },
  { key: "d", label: "Delete configuration", context: "providers" },
  { ...REVIEW_CONSENT_SHORTCUT, label: "Review provider data notice", context: "providers" },
  { ...SWITCH_PANE_SHORTCUT, context: "review" },
  { key: "1-4", label: "Switch Tab", context: "review" },
  { key: "↑/↓", label: "Scroll the focused pane", context: "review" },
  { key: "PgUp/PgDn", label: "Page up or down", context: "review" },
  { key: "Home/End", label: "Jump to start or end", context: "review" },
  { key: "/", label: "Search Runs", context: "history" },
  { key: "l", label: "Load Older Runs", context: "history" },
  { key: "R", label: "Retry History", context: "history" },
];

// Only the permission controls are shared. Each surface appends its own trailing
// actions (TUI: Tab/Quit; web: Quit plus its right-hand jump keys) rather than
// slicing a mixed array by position.
export const TRUST_PERMISSION_SHORTCUTS: Shortcut[] = [
  { key: "↑/↓", label: "Navigate Permissions" },
  { key: "Enter/Space", label: "Toggle" },
];
