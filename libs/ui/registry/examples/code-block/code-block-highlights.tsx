import { CodeBlock, CodeBlockContent, CodeBlockLine } from "@/components/ui/code-block"

const lines = [
  { content: "function calculateScore(review) {" },
  { content: "  const base = review.findings.length", type: "removed" as const },
  { content: "  const base = review.findings.filter(f => f.severity !== 'info').length", type: "added" as const },
  { content: "" },
  { content: "  // Apply severity weights", type: "highlight" as const },
  { content: "  return base * review.weight" },
  { content: "}" },
]

export default function CodeBlockHighlights() {
  return (
    <CodeBlock>
      <CodeBlockContent>
        {lines.map((line, i) => (
          <CodeBlockLine key={i} number={i + 1} {...line} />
        ))}
      </CodeBlockContent>
    </CodeBlock>
  )
}
