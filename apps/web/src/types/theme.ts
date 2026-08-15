import type { ResolvedSelectableTheme, SelectableTheme } from "@diffgazer/core/schemas/config";

export interface ThemeContextValue {
  /** The reader's choice, including "auto". */
  theme: SelectableTheme;
  /** The choice after "auto" is resolved against `system`; this is what the document wears. */
  resolved: ResolvedSelectableTheme;
  /** The current OS color scheme, tracked live. */
  system: ResolvedSelectableTheme;
  setTheme: (theme: SelectableTheme) => Promise<void>;
}
