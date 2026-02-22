// @vitest-environment jsdom

import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { CodeBlock } from "@/components/ui/code-block/code-block"

describe("CodeBlock", () => {
  it("renders highlighted HTML token content from line data", () => {
    render(
      <CodeBlock
        label="tsx"
        lines={[
          {
            number: 1,
            content:
              '<span style="color:var(--code-keyword)">const</span> <span style="color:var(--code-variable)">x</span>',
          },
        ]}
      />,
    )

    expect(screen.getByText("tsx")).not.toBeNull()
    expect(screen.getByText("const")).not.toBeNull()
    expect(document.querySelector('span[style*="--code-keyword"]')).not.toBeNull()
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
