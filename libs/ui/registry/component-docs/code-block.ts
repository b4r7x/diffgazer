import type { ComponentDoc } from "./types"

export const codeBlockDoc: ComponentDoc = {
  description:
    "Compound code display with per-line control. CodeBlock is a pure container with aria-label support. CodeBlockContent accepts string children (auto-splits into numbered lines) or composed CodeBlockLine children for per-line control. Compose with Header, Label, and Line parts.",
  notes: [
    {
      title: "Compound API",
      content:
        "CodeBlock is the root container. CodeBlockContent is the scrollable code body — pass a string for auto-rendering, or map line data to CodeBlockLine children for per-line types and token coloring. CodeBlockHeader holds a CodeBlockLabel and optional actions. CodeBlockLine renders one line with optional gutter and token coloring.",
    },
    {
      title: "Labeling & Language",
      content:
        "CodeBlock accepts an optional `label` prop for a custom aria-label. When `language` is set (e.g. 'TypeScript'), the aria-label auto-derives to '{language} code'. Explicit `label` always takes priority over language-derived text. A `data-language` attribute is added for CSS targeting.",
    },
    {
      title: "Line Numbers",
      content:
        "In auto-split mode (string children), CodeBlockContent controls line numbering via its `showLineNumbers` prop (defaults to true). In composed mode (CodeBlockLine children), line numbers appear when you pass the `number` prop — omit it to hide the gutter.",
    },
    {
      title: "Line Types",
      content:
        "Each CodeBlockLine can have a type of 'highlight' (full-width background), 'added' (success green text), or 'removed' (destructive red text). Lines without a type render in the default muted foreground color.",
    },
    {
      title: "Token-based Highlighting",
      content:
        "Line content can be a plain string or an array of CodeBlockToken objects ({ text, color?, className? }) for syntax-colored output. No HTML parsing — tokens render directly as React elements.",
    },
    {
      title: "Keyboard Scrolling",
      content:
        "CodeBlockContent is keyboard-focusable (tabIndex=0). Users can Tab to the code area and scroll with arrow keys when content overflows.",
    },
  ],
  anatomy: [
    { name: "CodeBlock", indent: 0, note: "Root container with aria-label support" },
    { name: "CodeBlockHeader", indent: 1, note: "Header with label and optional actions" },
    { name: "CodeBlockLabel", indent: 2, note: "Language or title label" },
    { name: "CodeBlockContent", indent: 1, note: "Scrollable code body (auto-split or composed)" },
    { name: "CodeBlockLine", indent: 2, note: "Single line with optional gutter and token coloring" },
  ],
  usage: { example: "code-block-default" },
  examples: [
    { name: "code-block-default", title: "Default" },
    { name: "code-block-highlights", title: "Highlights" },
  ],
  keyboard: null,
}
