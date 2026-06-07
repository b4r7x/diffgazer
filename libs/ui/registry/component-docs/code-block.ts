import type { ComponentDoc } from "./types";

export const codeBlockDoc: ComponentDoc = {
  description:
    "Compound code display with three visual variants (hairline, bare, terminal), per-line diff/highlight states, an optional copy button, and optional lowlight-powered syntax highlighting. Renders as a <figure> with accessible name resolution via aria-labelledby (CodeBlock.Label) or aria-label fallback.",
  notes: [
    {
      title: "Variants",
      content:
        'variant="hairline" (default) renders a 1px soft border with a header row for filename + actions. variant="bare" removes all chrome and renders a 2px left rule that turns accent on hover; the header is suppressed. variant="terminal" centers the title in the header and renders three desaturated dots by default (chrome="dots"). Pass chrome="none" for a terminal pane without window dots. All chrome is driven by [data-variant] and [data-chrome] selectors in shared/code-block.css; consumers do not need to apply any classes manually.',
    },
    {
      title: "Compound API",
      content:
        "CodeBlock is the root <figure>. CodeBlock.Header holds the filename label and inline actions. CodeBlock.Label renders the filename and is registered as the accessible name via aria-labelledby. CodeBlock.Content is the scrollable code body — pass a string for auto-line splitting, or map line data to CodeBlock.Line children. CodeBlock.CopyButton copies a string to the clipboard with an aria-live announcement. CodeBlockHighlight (imported from @diffgazer/ui/components/code-block/highlight) optionally renders syntax-colored code via lowlight (~190 languages).",
    },
    {
      title: "Accessible Name",
      content:
        'Precedence: aria-labelledby > aria-label > <CodeBlock.Label> > `label` prop > "<language> code" > "Code block". When you render <CodeBlock.Label>, the figure picks it up automatically via an internal id.',
    },
    {
      title: "Line States",
      content:
        'Each CodeBlock.Line exposes a `state` prop: "added" tints the row with success color and renders a sr-only "Added: " prefix; "removed" tints with destructive color and a "Removed: " prefix; "highlight" tints with foreground color. The tint is applied to the row, not the <code>, so syntax-color themes remain readable.',
    },
    {
      title: "Optional Auto-Coloring",
      content:
        'CodeBlockHighlight is a separate subpath import: `import { CodeBlockHighlight } from "@diffgazer/ui/components/code-block/highlight"`. It is split from the main <CodeBlock> bundle so consumers who never render it are not charged for the lowlight grammar bundle. `lowlight` is declared as an optional peer dependency — install it only when you import CodeBlockHighlight. The component emits highlight.js-compatible class names (hljs-keyword, hljs-string, ...) which the shared CSS maps onto the --code-* theme tokens.',
    },
    {
      title: "Keyboard Scrolling",
      content:
        "CodeBlock.Content renders a scrollable region wired through ScrollArea. The inner scroller is keyboard-focusable (tabIndex=0) and exposes the figure's accessible name to screen readers; the scroller is the landmark (role=region), not the figure. Users can Tab to the code area and scroll with arrow keys when content overflows.",
    },
    {
      title: "Token-based Highlighting",
      content:
        "Line content can be a plain string or an array of CodeBlockToken objects ({ text, color?, className? }) for syntax-colored output. No HTML parsing — tokens render directly as React elements. Use `.code-*` class names to bind to the shared theme tokens.",
    },
  ],
  anatomy: [
    { name: "CodeBlock", indent: 0, note: "Root <figure>" },
    {
      name: "CodeBlock.Header",
      indent: 1,
      note: "Header row (filename + actions); hidden in bare variant",
    },
    {
      name: "CodeBlock.Label",
      indent: 2,
      note: "Filename label, wired to figure's accessible name",
    },
    { name: "CodeBlock.CopyButton", indent: 2, note: "Optional copy-to-clipboard button" },
    {
      name: "CodeBlock.Content",
      indent: 1,
      note: "Scrollable <pre> body (auto-split or composed)",
    },
    {
      name: "CodeBlock.Line",
      indent: 2,
      note: "Single line with optional gutter, diff state, and token coloring",
    },
    {
      name: "CodeBlockHighlight",
      indent: 1,
      note: "Optional auto-colored content (subpath import; uses lowlight)",
    },
  ],
  usage: { example: "code-block-default" },
  examples: [
    { name: "code-block-default", title: "Default" },
    { name: "code-block-hairline", title: "Hairline" },
    { name: "code-block-bare", title: "Bare" },
    { name: "code-block-terminal", title: "Terminal" },
    { name: "code-block-highlights", title: "Diff & Highlight states" },
    { name: "code-block-highlighted", title: "Syntax highlighting" },
  ],
  keyboard: null,
  props: {
    CodeBlock: {
      variant: {
        type: '"hairline" | "bare" | "terminal"',
        required: false,
        defaultValue: '"hairline"',
        description:
          'Visual variant. "hairline" (default) is a soft-bordered block with a filename header. "bare" removes chrome and renders a 2px left rule that turns accent on hover; the header is suppressed. "terminal" centers the title in the header — use for shell output. Window dots are controlled separately via the `chrome` prop and default to "dots" for variant="terminal".',
      },
      language: {
        type: "string",
        required: false,
        defaultValue: null,
        description:
          'Language identifier exposed as data-language and used in the default aria-label ("{language} code").',
      },
      label: {
        type: "string",
        required: false,
        defaultValue: null,
        description:
          'Optional accessible name when no <CodeBlock.Label> is rendered. Falls back to "{language} code" or "Code block".',
      },
      chrome: {
        type: '"dots" | "none"',
        required: false,
        defaultValue: '"dots" for variant="terminal", "none" otherwise',
        description:
          'Decorative chrome in the header strip. "dots" renders three desaturated terminal-style dots on the left edge and reserves symmetric padding so a centered label stays balanced. "none" disables chrome — useful for a terminal pane without window dots.',
      },
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description: "Header and Content subparts.",
      },
    },
    CodeBlockHeader: {
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description:
          'Typically a CodeBlock.Label and optional action buttons. Returns null when the parent variant is "bare".',
      },
    },
    CodeBlockLabel: {
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description:
          "Filename or language text. Bound to the figure's accessible name via aria-labelledby.",
      },
    },
    CodeBlockContent: {
      showLineNumbers: {
        type: "boolean",
        required: false,
        defaultValue: "true",
        description: "Auto-split mode only. Renders a line-number gutter for string children.",
      },
      tone: {
        type: '"default" | "diff"',
        required: false,
        defaultValue: '"default"',
        description:
          'Surfaces as data-tone on the <pre>. Use "diff" when the content contains added/removed lines.',
      },
      children: {
        type: "string | ReactNode",
        required: false,
        defaultValue: null,
        description:
          "Code source: a string is auto-split into numbered CodeBlock.Line children; composed CodeBlock.Line children render as-is.",
      },
    },
    CodeBlockLine: {
      number: {
        type: "number",
        required: false,
        defaultValue: null,
        description: "Line number rendered in the gutter. Omit to hide the gutter for this line.",
      },
      content: {
        type: "string | { text: string; color?: string; className?: string }[]",
        required: false,
        defaultValue: null,
        description:
          "Line content. Either a plain string or an array of tokens for syntax coloring. Ignored when `children` is provided.",
      },
      children: {
        type: "ReactNode",
        required: false,
        defaultValue: null,
        description:
          "Pre-rendered line body (e.g. highlighted React elements). Takes precedence over `content` and renders inside the <code> element.",
      },
      state: {
        type: '"highlight" | "added" | "removed"',
        required: false,
        defaultValue: null,
        description:
          'Per-line visual state. "highlight" tints the row; "added"/"removed" render gutter sign characters (+/−), color tint, and an sr-only "Added: "/"Removed: " prefix for assistive tech.',
      },
    },
    CodeBlockCopyButton: {
      source: {
        type: "string",
        required: true,
        defaultValue: null,
        description: "Text copied to the clipboard on click.",
      },
      copyLabel: {
        type: "string",
        required: false,
        defaultValue: '"Copy code to clipboard"',
        description: "Accessible label for the button (overrideable for localization).",
      },
      copiedMessage: {
        type: "string",
        required: false,
        defaultValue: '"Copied"',
        description: "Status message announced via aria-live after a successful copy.",
      },
      onCopy: {
        type: "(source: string) => void",
        required: false,
        defaultValue: null,
        description: "Called after a successful clipboard write.",
      },
      onCopyError: {
        type: "(error: unknown) => void",
        required: false,
        defaultValue: null,
        description: "Called when the clipboard write fails or the API is unavailable.",
      },
    },
    CodeBlockHighlight: {
      code: {
        type: "string",
        required: true,
        defaultValue: null,
        description: "Source code to highlight. Each newline becomes a separate row.",
      },
      language: {
        type: "string",
        required: false,
        defaultValue: null,
        description:
          'Language identifier consumed by lowlight (e.g. "ts", "tsx", "bash", "json"). Omit to use lowlight\'s auto-detection.',
      },
      showLineNumbers: {
        type: "boolean",
        required: false,
        defaultValue: "true",
        description: "Renders a line-number gutter when true.",
      },
      lineStates: {
        type: 'Record<number, "highlight" | "added" | "removed">',
        required: false,
        defaultValue: null,
        description:
          "Optional per-line state map keyed by 1-based line number. Applied to the underlying CodeBlock.Line for each row.",
      },
    },
  },
};
