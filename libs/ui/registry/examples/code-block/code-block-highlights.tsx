import { CodeBlock } from "@/components/ui/code-block"

const lines = [
  { content: "function calculateScore(review) {" },
  { content: "  const base = review.findings.length", state: "removed" as const },
  { content: "  const base = review.findings.filter(f => f.severity !== 'info').length", state: "added" as const },
  { content: "" },
  { content: "  // Apply severity weights", state: "highlight" as const },
  { content: "  return base * review.weight" },
  { content: "}" },
]

export default function CodeBlockHighlights() {
  return (
    <CodeBlock language="ts">
      <CodeBlock.Header>
        <CodeBlock.Label>scoring.ts</CodeBlock.Label>
      </CodeBlock.Header>
      <CodeBlock.Content>
        {lines.map((line, i) => (
          <CodeBlock.Line key={i} number={i + 1} {...line} />
        ))}
      </CodeBlock.Content>
    </CodeBlock>
  )
}
