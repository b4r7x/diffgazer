import { CopyButton } from "@/components/copy-button"
import { CodeBlock, CodeBlockHeader, CodeBlockLabel, CodeBlockContent } from "@/components/ui/code-block"

interface CssOutputProps {
  primitives: Record<string, string>
  defaults: Record<string, string>
}

export function CssOutput({ primitives, defaults }: CssOutputProps) {
  const changed = Object.entries(primitives).filter(
    ([key, val]) => val !== defaults[key]
  )

  if (changed.length === 0) {
    return (
      <p className="text-xs text-muted-foreground font-mono">
        No changes yet. Edit a color above to generate CSS.
      </p>
    )
  }

  const css = `:root {\n${changed.map(([k, v]) => `  ${k}: ${v};`).join("\n")}\n}`

  return (
    <CodeBlock>
      <CodeBlockHeader>
        <CodeBlockLabel>css</CodeBlockLabel>
        <CopyButton text={css} />
      </CodeBlockHeader>
      <CodeBlockContent>
        <code>{css}</code>
      </CodeBlockContent>
    </CodeBlock>
  )
}
