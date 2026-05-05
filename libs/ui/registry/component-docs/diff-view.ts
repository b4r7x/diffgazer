import type { ComponentDoc } from "./types"

export const diffViewDoc: ComponentDoc = {
  description:
    "Diff viewer with unified and side-by-side modes. Accepts unified diff strings, before/after text, or pre-parsed diff data.",
  notes: [
    {
      title: "Patch Format",
      content:
        "DiffView accepts a standard unified diff string (the output of git diff). Lines starting with + are green, - are red, @@ are foreground.",
    },
    {
      title: "View Modes",
      content:
        'Use mode="unified" (default) for inline diff or mode="split" for side-by-side comparison. Both modes show hunk separators (@@ headers) between change groups.',
    },
    {
      title: "Before/After Input",
      content:
        "Instead of a patch string, pass before and after props with raw text. The component computes the diff automatically using LCS.",
    },
    {
      title: "Word Diff",
      content:
        "Word-level highlighting is enabled by default — changed words within modified lines get a subtle background highlight. Disable with disableWordDiff.",
    },
    {
      title: "Multi-file Diffs",
      content:
        "parseDiff() returns ParsedDiff[] and handles full git diff output with multiple files. Map over the result and render each file with a separate DiffView using the diff prop.",
    },
    {
      title: "Accessibility",
      content:
        "Pass a label prop for a custom aria-label on the diff region. The split view labels columns as Old/New for screen readers. Hunk headers include descriptive aria-labels.",
    },
    {
      title: "Standalone Utilities",
      content:
        "The pure diff functions (parseDiff, computeDiff) are available separately via diff. Install with `dgadd add diff` to use them without the DiffView component.",
    },
  ],
  anatomy: [
    { name: "DiffView", indent: 0 },
  ],
  usage: { example: "diff-view-default" },
  examples: [
    { name: "diff-view-default", title: "Default" },
    { name: "diff-view-minimal", title: "Minimal" },
    { name: "diff-view-split", title: "Split" },
    { name: "diff-view-compare", title: "Compare" },
    { name: "diff-view-with-header", title: "With Header" },
    { name: "diff-view-line-numbers", title: "Line Numbers" },
  ],
  keyboard: {
    description: "When the diff container is focused, j/k navigate between hunks. The active hunk scrolls into view and is highlighted with a ring. Press Escape to clear the selection.",
    examples: [], // No dedicated keyboard example — j/k navigation is demonstrated in diff-view-default
  },
}
