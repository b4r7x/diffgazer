import type { ComponentDoc } from "./types"

export const diffViewDoc: ComponentDoc = {
  description:
    "Diff viewer with unified and side-by-side modes, five visual variants (hairline, bare, dense, viewfinder, statusbar), orthogonal density and palette axes, an opt-in vertical scroll wrapper, and a consumer-filled status-bar slot. Renders as a <figure> with accessible-name resolution via aria-labelledby (figcaption) or aria-label fallback, and exposes keyboard hunk navigation (j/k + Escape).",
  notes: [
    {
      title: "Requires @diffgazer/keys (package mode)",
      content:
        "DiffView's keyboard hunk navigation (j/k + Escape) imports from the optional @diffgazer/keys peer. Package/npm consumers must install it: `npm install @diffgazer/keys`. Importing @diffgazer/ui/components/diff-view without keys fails at module load with an error naming the missing @diffgazer/keys package. Copy/dgadd consumers do not need the package — copy mode rewrites the keyboard hooks to local source.",
    },
    {
      title: "Variants",
      content:
        'variant="hairline" (default) is the dashboard-grade safe default with a 1px soft border. variant="bare" removes all chrome and renders a 2px left rule that turns accent on hover; the figcaption is suppressed. variant="dense" tightens typography and adds visible dividers between number columns for Gerrit/Reviewable-style review density. variant="viewfinder" renders four bracketed corners for the diff family-consistent inspection language. variant="statusbar" renders a hairline top + content + an optional consumer-filled bottom slot. All variant chrome is driven by [data-variant] selectors in shared/diff-view.css.',
    },
    {
      title: "Inputs",
      content:
        "DiffView accepts one of three inputs: a unified diff string (`patch`), before/after raw text (`before`+`after`, computed via LCS), or pre-parsed data (`diff: ParsedDiff`). For multi-file diffs use parseDiff() externally and render one DiffView per file with the `diff` prop.",
    },
    {
      title: "Accessible Name",
      content:
        'Precedence: figcaption (when a file label can be derived from the patch and variant !== "bare") > `label` prop > "Diff output". The figure exposes aria-labelledby when a figcaption renders, otherwise aria-label. variant="bare" always suppresses the figcaption so the `label` prop becomes the figure name.',
    },
    {
      title: "Line States",
      content:
        'Each change row exposes `data-state="added" | "removed" | "context" | "hunk" | "empty"` on a `data-row` span. Row tints, marker color, and the strong-tier word-diff overlay all derive from these attributes and the upstream --success/--destructive tokens — no inline styles are emitted, so the contract is CSP-safe.',
    },
    {
      title: "Density and Palette",
      content:
        'density ("compact" | "default" | "comfortable") and palette ("default" | "okabe-ito") are orthogonal axes that compose with any variant. variant="dense" defaults density to "compact"; pass an explicit `density` to override. palette="okabe-ito" swaps to a colorblind-safe blue/orange pair via --success and --destructive overrides on the figure.',
    },
    {
      title: "Word Diff",
      content:
        "Intra-line word highlighting is enabled by default — changed slices on add/remove rows are wrapped in <span data-word=\"added|removed\"> and tinted with the strong-tier overlay. Disable per-line word annotation with `disableWordDiff`.",
    },
    {
      title: "Vertical Scroll",
      content:
        "Pass a CSS length to `maxHeight` to opt into a vertical scroll wrapper around the rows container. The figure sets the --dv-max-h CSS variable and `data-max-h`; the shared CSS pins the scroll wrapper height and renders a thin scrollbar. Horizontal scroll still works per-row independently.",
    },
    {
      title: "Status Bar Slot",
      content:
        'variant="statusbar" reveals a headless bottom slot the consumer fills via the `statusBar` prop. The primitive deliberately ships no hard-coded kbd hints, no stats summary, and no copy — render whatever your app needs (diff stats, Kbd hints, action buttons). When `statusBar` is omitted the slot is not rendered at all.',
    },
    {
      title: "Standalone Utilities",
      content:
        "The pure diff functions (parseDiff, computeDiff, resolveDiffInput) and types (ParsedDiff, DiffHunk, DiffChange, ChangeType, DiffInput) are re-exported from the same module so consumers can compose with the primitive or use the diff utilities standalone.",
    },
  ],
  anatomy: [
    { name: "DiffView", indent: 0, note: "Root <figure> with aria-roledescription=\"diff\"" },
    { name: "figcaption", indent: 1, note: "File path / rename label; bound to the figure's accessible name; suppressed in variant=\"bare\"" },
    { name: "[data-slot=\"diff-view-corners\"]", indent: 1, note: "Four bracketed corner spans (variant=\"viewfinder\" only)" },
    { name: "[data-slot=\"diff-view-scroll-v\"]", indent: 1, note: "Vertical-scroll wrapper around the rows container (only when maxHeight is set)" },
    { name: "[data-slot=\"diff-view-rows\"] | [data-slot=\"diff-view-split\"]", indent: 2, note: "Focusable, labeled, keyboard-navigable rows container (unified or split)" },
    { name: "[data-row][data-state]", indent: 3, note: "Per-change row; state drives row tint, marker color, and word-diff overlay" },
    { name: ".diff-num", indent: 4, note: "Old / new line number cell (when showLineNumbers)" },
    { name: ".diff-marker", indent: 4, note: "+ / − / space cell; user-selectable so copy-paste keeps the diff marker" },
    { name: ".diff-code", indent: 4, note: "Code cell; may contain <span data-word=\"added|removed\"> for word-diff overlay" },
    { name: "[data-slot=\"diff-view-statusbar\"]", indent: 1, note: "Consumer-filled bottom slot (variant=\"statusbar\" + statusBar prop)" },
  ],
  usage: { example: "diff-view-default" },
  examples: [
    { name: "diff-view-default", title: "Default" },
    { name: "diff-view-minimal", title: "Minimal" },
    { name: "diff-view-hairline", title: "Hairline" },
    { name: "diff-view-bare", title: "Bare" },
    { name: "diff-view-dense", title: "Dense" },
    { name: "diff-view-viewfinder", title: "Viewfinder" },
    { name: "diff-view-statusbar", title: "Status bar" },
    { name: "diff-view-palette-okabe-ito", title: "Palette: Okabe–Ito" },
    { name: "diff-view-max-height", title: "Max height (V-scroll)" },
    { name: "diff-view-split", title: "Split mode" },
    { name: "diff-view-line-numbers", title: "Line numbers" },
    { name: "diff-view-compare", title: "Before / after compare" },
    { name: "diff-view-with-header", title: "With header label" },
  ],
  keyboard: {
    description:
      "When the rows container is focused, j moves to the next hunk and k moves to the previous one. Navigation does not wrap. Escape clears the active hunk. The active hunk is highlighted with an inset ring and announced via an aria-live region.",
    examples: [],
  },
  props: {
    DiffView: {
      patch: {
        type: "string",
        required: false,
        defaultValue: null,
        description: "Unified diff string (git diff output). One of patch, before+after, or diff must be supplied.",
      },
      before: {
        type: "string",
        required: false,
        defaultValue: null,
        description: "Old text. Pair with `after` to let DiffView compute the diff via LCS.",
      },
      after: {
        type: "string",
        required: false,
        defaultValue: null,
        description: "New text. Pair with `before`.",
      },
      diff: {
        type: "ParsedDiff",
        required: false,
        defaultValue: null,
        description: "Pre-parsed diff data, useful when displaying one file out of a multi-file parseDiff() result.",
      },
      variant: {
        type: '"hairline" | "bare" | "dense" | "viewfinder" | "statusbar"',
        required: false,
        defaultValue: '"hairline"',
        description:
          'Visual variant. "hairline" (default) is the dashboard-safe bordered look. "bare" removes chrome and renders a 2px left rule; the figcaption is suppressed. "dense" tightens typography and adds visible number-column dividers. "viewfinder" renders four bracketed corners. "statusbar" reveals the bottom statusBar slot.',
      },
      density: {
        type: '"compact" | "default" | "comfortable"',
        required: false,
        defaultValue: '"default" (or "compact" when variant="dense")',
        description: 'Vertical density. Surfaces as data-density on the figure. Orthogonal to variant; variant="dense" defaults this to "compact" unless overridden.',
      },
      palette: {
        type: '"default" | "okabe-ito"',
        required: false,
        defaultValue: '"default"',
        description: 'Color palette for added/removed rows. "okabe-ito" overrides --success/--destructive with a colorblind-safe blue/orange pair. Surfaces as data-diff-palette on the figure.',
      },
      mode: {
        type: '"unified" | "split"',
        required: false,
        defaultValue: '"unified"',
        description: "Inline unified view or side-by-side split panes (Old / New).",
      },
      showLineNumbers: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description: "Renders line-number gutters. Surfaces as data-line-numbers on the rows container.",
      },
      disableWordDiff: {
        type: "boolean",
        required: false,
        defaultValue: "false",
        description: "Disables intra-line word-level highlighting on added/removed rows.",
      },
      maxHeight: {
        type: "string",
        required: false,
        defaultValue: null,
        description: "CSS length applied to an opt-in vertical scroll wrapper. When set, the rows container gets a fixed max-height and a y-axis scrollbar via the --dv-max-h CSS variable.",
      },
      statusBar: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: 'Headless bottom slot rendered when variant="statusbar". Fill with whatever your app needs (diff stats, Kbd hints, actions). Omit to suppress the slot entirely.',
      },
      label: {
        type: "string",
        required: false,
        defaultValue: '"Diff output"',
        description: "Accessible name applied as aria-label when no figcaption renders (variant=\"bare\" or a patch without paths).",
      },
      className: {
        type: "string",
        required: false,
        defaultValue: null,
        description: "Additional class names merged onto the root <figure>.",
      },
      ref: {
        type: "Ref<HTMLElement>",
        required: false,
        defaultValue: null,
        description: "Ref to the root <figure> element.",
      },
    },
  },
}
