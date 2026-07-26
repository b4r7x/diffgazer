import type { BoxProps } from "ink";
import type { CliColorTokens } from "./palettes";

/**
 * Every TUI surface — panel, dialog, callout, split pane, input, code block —
 * draws the same square hairline. This is the terminal half of the shared
 * hairline motif the web shell uses; rounded boxes are not part of it.
 */
export const SURFACE_BORDER = "single";

/**
 * Selection and focus share one hue with the web app, whose focus ring is the
 * same blue: a highlighted row fill, a focused pane border, a selected-row
 * marker. Accent purple is reserved for primary actions. Pane and row stay
 * distinct by form — border against fill — rather than by hue.
 *
 * Text drawn on this as a fill uses `bg`, the only foreground that clears
 * 4.5:1 against it in both palettes (7.5:1 dark, 5.2:1 light); `fg` on accent
 * was 2.1:1 and failed.
 */
export function selectionHue(tokens: CliColorTokens): string {
  return tokens.blue;
}

/** Border for a split pane or input: the selection hue while it holds focus. */
export function focusBorder(tokens: CliColorTokens, isFocused: boolean): string {
  return isFocused ? selectionHue(tokens) : tokens.border;
}

/**
 * The terminal half of the product reticle. A resting pane draws the plain
 * hairline; the pane that holds focus keeps light edges and steps its four
 * corners up to the heavy box-drawing weight — the terminal analogue of the
 * web ring growing its corners. One reticle per screen.
 */
export const RETICLE_BORDER = {
  topLeft: "┏",
  top: "─",
  topRight: "┓",
  left: "│",
  right: "│",
  bottomLeft: "┗",
  bottom: "─",
  bottomRight: "┛",
} as const;

export interface PaneBorder {
  borderStyle: NonNullable<BoxProps["borderStyle"]>;
  borderColor: string;
}

/** The full border contract for a pane that can take focus. */
export function paneBorder(tokens: CliColorTokens, isFocused: boolean): PaneBorder {
  return {
    borderStyle: isFocused ? RETICLE_BORDER : SURFACE_BORDER,
    borderColor: focusBorder(tokens, isFocused),
  };
}

export interface RowTone {
  /** Row fill. Only set while the row is highlighted in a focused list. */
  background: string | undefined;
  /** Label / primary text color. */
  primary: string;
  /** Supporting text color (hotkeys, counts, timestamps, values). */
  secondary: string;
}

export interface RowToneOptions {
  isHighlighted: boolean;
  /** False while the list sits in a pane that does not hold focus. */
  isActive?: boolean;
  /** Replaces the selection fill, for example a destructive menu row. */
  fill?: string;
}

/**
 * One selection idiom for every list: the highlighted row of a focused list is
 * a full-width fill with the row text drawn in the background token. A list
 * that lost focus keeps its row named in the fill colour instead of painting
 * it, so two side-by-side panes never claim the highlight at once.
 */
export function rowTone(
  tokens: CliColorTokens,
  { isHighlighted, isActive = true, fill = selectionHue(tokens) }: RowToneOptions,
): RowTone {
  if (!isHighlighted) {
    return { background: undefined, primary: tokens.fg, secondary: tokens.muted };
  }
  if (!isActive) {
    return { background: undefined, primary: fill, secondary: tokens.muted };
  }
  return { background: fill, primary: tokens.bg, secondary: tokens.bg };
}
