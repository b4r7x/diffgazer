import { useDocData } from "../doc-data-context"
import { CopyButton } from "@/components/copy-button"
import { CodeBlock, CodeBlockContent, CodeBlockHeader, CodeBlockLabel, CodeBlockLine } from "@/components/ui/code-block"

export function UsageSnippet() {
  const data = useDocData()
  if (!data) return null
  const d = data.data

  const snippet = d.usageSnippet
  const highlighted = d.usageSnippetHighlighted
  if (!highlighted || highlighted.length === 0) return null

  const lang = data.type === "hook" ? (d.docs?.usage?.lang ?? "tsx") : "tsx"

  return (
    <CodeBlock>
      <CodeBlockHeader>
        <CodeBlockLabel>{lang}</CodeBlockLabel>
        {snippet && <CopyButton text={snippet} />}
      </CodeBlockHeader>
      <CodeBlockContent>
        {highlighted.map(line => (
          <CodeBlockLine key={line.number} {...line} />
        ))}
      </CodeBlockContent>
    </CodeBlock>
  )
}
