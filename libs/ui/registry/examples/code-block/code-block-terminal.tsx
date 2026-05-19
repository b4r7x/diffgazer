import { CodeBlock } from "@/components/ui/code-block"

const output = `$ pnpm install
Lockfile is up to date, resolution step is skipped
Already up to date

Done in 1.2s`

export default function CodeBlockTerminal() {
  return (
    <CodeBlock variant="terminal" language="bash">
      <CodeBlock.Header>
        <CodeBlock.Label>~/diffgazer · zsh</CodeBlock.Label>
      </CodeBlock.Header>
      <CodeBlock.Content showLineNumbers={false}>{output}</CodeBlock.Content>
    </CodeBlock>
  )
}
