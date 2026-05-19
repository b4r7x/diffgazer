import { CodeBlock } from "@/components/ui/code-block"

const code = `const greeting = "Hello, world!"
console.log(greeting)`

export default function CodeBlockBare() {
  return (
    <CodeBlock variant="bare" language="ts">
      <CodeBlock.Content showLineNumbers={false}>{code}</CodeBlock.Content>
    </CodeBlock>
  )
}
