import { CodeBlock } from "@/components/ui/code-block"

const code = `function add(a: number, b: number) {
  return a + b
}`

export default function CodeBlockHairline() {
  return (
    <CodeBlock variant="hairline" language="ts">
      <CodeBlock.Header>
        <CodeBlock.Label>math.ts</CodeBlock.Label>
        <CodeBlock.CopyButton source={code} />
      </CodeBlock.Header>
      <CodeBlock.Content>{code}</CodeBlock.Content>
    </CodeBlock>
  )
}
