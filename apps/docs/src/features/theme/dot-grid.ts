/**
 * The shared dot-grid backdrop for theme preview surfaces. The dot color is the
 * selection primitive token so it follows the active theme and re-tints when the
 * playground edits the palette, instead of freezing the dark-theme value.
 */
export const DOT_GRID_CLASS =
  "bg-[radial-gradient(var(--base-selection)_1px,transparent_1px)] [background-size:20px_20px]";
