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
 */
export type PreviewFrame = "default" | "inset" | "fill";

const INSET_EXAMPLES = new Set<string>([
  "sidebar-default",
  "sidebar-variants",
  "sidebar-collapsible",
  "sidebar-variant-bar",
  "sidebar-variant-block",
  "sidebar-variant-bracket",
  "sidebar-variant-caret",
  "sidebar-variant-inverted",
  "sidebar-variant-tree",
  "sidebar-render-prop",
  "sidebar-auto-tone",
]);

const FILL_EXAMPLES = new Set<string>(["sidebar-rail", "sidebar-mobile-sheet"]);

export function resolvePreviewFrame(exampleName: string): PreviewFrame {
  if (INSET_EXAMPLES.has(exampleName)) return "inset";
  if (FILL_EXAMPLES.has(exampleName)) return "fill";
  return "default";
}
