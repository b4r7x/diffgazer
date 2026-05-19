import { CodeBlock } from "@/components/ui/code-block"

const code = `import { Button } from "@/components/ui/button"

export function App() {
  return (
    <Button variant="primary">
      Click me
    </Button>
  )
}`

export default function CodeBlockDefault() {
  return (
    <CodeBlock language="tsx">
      <CodeBlock.Header>
        <CodeBlock.Label>app.tsx</CodeBlock.Label>
        <CodeBlock.CopyButton source={code} />
      </CodeBlock.Header>
      <CodeBlock.Content>{code}</CodeBlock.Content>
    </CodeBlock>
  )
}
