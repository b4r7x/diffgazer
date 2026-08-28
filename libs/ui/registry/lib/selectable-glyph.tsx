import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Tone options for a rendered bracket glyph. */
export interface SelectableGlyphOptions {
  /** True on a highlighted collection row, where the brackets sit on the inverted fill. */
  highlighted?: boolean;
  /** True on a disabled control, where the whole glyph inherits one structural tone. */
  disabled?: boolean;
}

/**
 * Splits a bracket glyph into dim chrome and a full-contrast mark.
 *
 * `[` and `]` are chrome and go muted; the inner character is content and keeps the surrounding
 * tone at bold weight.
 *
 * The mark carries no color of its own: it inherits whatever the indicator or stepper glyph
 * variant resolved (checked, status, disabled), so this adds hierarchy without adding a token.
 * Glyphs that are not bracketed — the breadcrumb `✓`, the numbered square — pass through unchanged.
 */
export function renderSelectableGlyph(
  glyph: string,
  options: SelectableGlyphOptions = {},
): ReactNode {
  if (glyph.length < 2 || !glyph.startsWith("[") || !glyph.endsWith("]")) return glyph;

  const { highlighted = false, disabled = false } = options;
  const bracketClass = cn(
    "font-normal",
    !disabled && (highlighted ? "text-foreground/70" : "text-muted-foreground"),
  );

  return (
    <>
      <span className={bracketClass}>[</span>
      <span className="font-bold">{glyph.slice(1, -1)}</span>
      <span className={bracketClass}>]</span>
    </>
  );
}
