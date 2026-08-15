/**
 * Per-example preview frame selection for the docs `<Example>` / `<Examples>`
 * renderer. Layout-shaped components (sidebar, etc.) read better when wrapped
 * in a fake page so the reader can see the component IN context — pinned to
 * the left of a content area, not floating in the middle of a dot-grid pane.
 *
 * Lookup is by example name (the file name under `apps/docs/registry/examples`).
 * Keep this list narrow: only mark examples whose visual sense depends on
 * surrounding layout. Inline components (buttons, fields, badges) stay
 * `"default"`.
 *
 * `"compact"` is the same viewfinder pane with less vertical air, for
 * single-line components whose demo would otherwise float in a tall field of
 * empty dot grid.
 */
export type PreviewFrame = "default" | "compact" | "inset" | "fill";

/** Every example that opts out of `"default"`. Keys are example file names. */
export const EXAMPLE_FRAME_OVERRIDES: Record<string, PreviewFrame> = {
  "sidebar-default": "inset",
  "sidebar-variants": "inset",
  "sidebar-collapsible": "inset",
  "sidebar-variant-terminal": "inset",
  "sidebar-variant-tree": "inset",
  "sidebar-render-prop": "inset",
  "sidebar-auto-tone": "inset",
  "sidebar-rail": "fill",
  "sidebar-mobile-sheet": "fill",
  "breadcrumbs-default": "compact",
  "breadcrumbs-custom-separator": "compact",
  "breadcrumbs-custom-link": "compact",
  "breadcrumbs-ellipsis": "compact",
  "pager-default": "compact",
  "pager-render-prop": "compact",
  "pager-long-labels": "compact",
};

export function resolvePreviewFrame(exampleName: string): PreviewFrame {
  return EXAMPLE_FRAME_OVERRIDES[exampleName] ?? "default";
}
