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

  for (let i = 0; i < a.length; i++) {
    const left = a[i]!;
    const right = b[i]!;
    if (left.key !== right.key || left.label !== right.label || left.disabled !== right.disabled) {
      return false;
    }
  }

  return true;
}

// "Navigate"/"Select"/"Quit" matches the rest of the keyboard model
// (`j/k Navigate` in review, `Enter Select` everywhere else). Both web and CLI
// consume this single constant.
export const MAIN_MENU_SHORTCUTS: Shortcut[] = [
  { key: "↑/↓", label: "Navigate" },
  { key: "Enter", label: "Select" },
  { key: "q", label: "Quit" },
];
