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

const INSET_EXAMPLES = new Set<string>([
  "sidebar-default",
  "sidebar-variants",
  "sidebar-collapsible",
  "sidebar-variant-bar",
  "sidebar-variant-caret",
  "sidebar-variant-inverted",
  "sidebar-variant-terminal",
  "sidebar-variant-tree",
  "sidebar-render-prop",
  "sidebar-auto-tone",
]);

const FILL_EXAMPLES = new Set<string>(["sidebar-rail", "sidebar-mobile-sheet"]);

const COMPACT_EXAMPLES = new Set<string>([
  "breadcrumbs-default",
  "breadcrumbs-custom-separator",
  "breadcrumbs-custom-link",
  "breadcrumbs-ellipsis",
  "pager-default",
  "pager-render-prop",
  "pager-long-labels",
]);

export function resolvePreviewFrame(exampleName: string): PreviewFrame {
  if (INSET_EXAMPLES.has(exampleName)) return "inset";
  if (FILL_EXAMPLES.has(exampleName)) return "fill";
  if (COMPACT_EXAMPLES.has(exampleName)) return "compact";
  return "default";
}
