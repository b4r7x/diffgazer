/**
 * The shared dot-grid backdrop for theme preview surfaces. The dot color is a
 * translucent tint of the foreground, which aliases the `--base-fg` primitive,
 * so it still follows the active theme and re-tints when the playground edits
 * the palette, and it now reads at a comparable strength in both themes.
 *
 * It used to be `--base-selection`, which is a *surface* token: dark resolves it
 * to #333333 on a #0a0a0a page (1.6:1, the intended whisper) but light resolves
 * it to #e8edf3 on #f7f8f5 (1.1:1), a surface deliberately near the background,
 * so the light grid was effectively invisible. Mixing the foreground instead
 * guarantees a contrasting source in any theme, because foreground and
 * background are always a legible pair. Measured in the browser, 20% composites
 * to #363636 over the dark page (1.64:1, within a hair of the 1.57:1 dark
 * already had) and #cbcdcc over the light one (1.50:1) — one percentage lands
 * both, because the two themes span a similar range between fg and bg.
 *
 * The `color-mix(in_oklab, var(--foreground) N%, ...)` spelling is the repo's
 * existing recipe for a tinted surface (see the card variants).
 */
export const DOT_GRID_CLASS =
  "bg-[radial-gradient(color-mix(in_oklab,var(--foreground)_20%,transparent)_1px,transparent_1px)] [background-size:20px_20px]";
