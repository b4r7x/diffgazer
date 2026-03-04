// @vitest-environment jsdom

import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { CodeBlock, CodeBlockHeader, CodeBlockLabel, CodeBlockContent, CodeBlockLine } from "@/components/ui/code-block"

describe("CodeBlock", () => {
  it("renders token-based highlighted content from line data", () => {
    render(
      <CodeBlock>
        <CodeBlockHeader>
          <CodeBlockLabel>tsx</CodeBlockLabel>
        </CodeBlockHeader>
        <CodeBlockContent>
          <CodeBlockLine
            number={1}
            content={[
              { text: "const", color: "var(--code-keyword)" },
              { text: " ", color: "var(--code-variable)" },
              { text: "x", color: "var(--code-variable)" },
            ]}
          />
        </CodeBlockContent>
      </CodeBlock>,
    )

    expect(screen.getByText("tsx")).not.toBeNull()
    expect(screen.getByText("const")).not.toBeNull()
    expect(screen.getByText("x")).not.toBeNull()
    expect(document.querySelector('span[style*="--code-keyword"]')).not.toBeNull()
  })

  it("renders plain string content", () => {
    render(
      <CodeBlock>
        <CodeBlockContent>
          <CodeBlockLine number={1} content="const x = 1" />
        </CodeBlockContent>
      </CodeBlock>,
    )

    expect(screen.getByText("const x = 1")).not.toBeNull()
  })

  it("renders children mode for MDX pre blocks", () => {
    render(
      <CodeBlock>
        <CodeBlockHeader>
          <CodeBlockLabel>bash</CodeBlockLabel>
        </CodeBlockHeader>
        <CodeBlockContent>
          <code>npm install keyscope</code>
        </CodeBlockContent>
      </CodeBlock>,
    )

    expect(screen.getByText("bash")).not.toBeNull()
    expect(screen.getByText("npm install keyscope")).not.toBeNull()
  })
})
