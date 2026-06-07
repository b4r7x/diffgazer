import { CodeBlock } from "@/components/ui/code-block";
import { CodeBlockHighlight } from "@/components/ui/code-block/highlight";

const code = `import { useState } from "react"

export function Counter() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(count + 1)}>{count}</button>
}`;

export default function CodeBlockHighlighted() {
  return (
    <CodeBlock language="tsx">
      <CodeBlock.Header>
        <CodeBlock.Label>counter.tsx</CodeBlock.Label>
        <CodeBlock.CopyButton source={code} />
      </CodeBlock.Header>
      <CodeBlockHighlight code={code} language="tsx" />
    </CodeBlock>
  );
}
