// @vitest-environment jsdom

import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { CodeBlock } from "@/components/ui/code-block/code-block"

describe("CodeBlock", () => {
  it("renders token-based highlighted content from line data", () => {
    render(
      <CodeBlock
        label="tsx"
        lines={[
          {
            number: 1,
            content: [
              { text: "const", color: "var(--code-keyword)" },
              { text: " ", color: "var(--code-variable)" },
              { text: "x", color: "var(--code-variable)" },
            ],
          },
        ]}
      />,
    )

    expect(screen.getByText("tsx")).not.toBeNull()
    expect(screen.getByText("const")).not.toBeNull()
    expect(screen.getByText("x")).not.toBeNull()
    expect(document.querySelector('span[style*="--code-keyword"]')).not.toBeNull()
  })

  it("renders plain string content", () => {
    render(
      <CodeBlock
        lines={[{ number: 1, content: "const x = 1" }]}
      />,
    )

    expect(screen.getByText("const x = 1")).not.toBeNull()
  })

  it("renders children mode for MDX pre blocks", () => {
    render(
      <CodeBlock label="bash">
        <code>npm install keyscope</code>
      </CodeBlock>,
    )

    expect(screen.getByText("bash")).not.toBeNull()
    expect(screen.getByText("npm install keyscope")).not.toBeNull()
  })
})
