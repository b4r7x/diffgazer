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
