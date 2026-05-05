import { CodeBlock, CodeBlockContent } from "@/components/ui/code-block"

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
    <CodeBlock>
      <CodeBlockContent>{code}</CodeBlockContent>
    </CodeBlock>
  )
}
