import { z } from "zod";

export const ShortcutSchema = z.object({
  key: z.string(),
  label: z.string(),
  disabled: z.boolean().optional(),
});
export type Shortcut = z.infer<typeof ShortcutSchema>;

export const ModeShortcutsSchema = z.object({
  keys: z.array(ShortcutSchema),
  menu: z.array(ShortcutSchema),
});
export type ModeShortcuts = z.infer<typeof ModeShortcutsSchema>;
