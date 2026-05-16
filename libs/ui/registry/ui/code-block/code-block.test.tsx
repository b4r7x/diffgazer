import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { axe } from "../../../testing/utils.js"
import { CodeBlock } from "./index.js"

describe("CodeBlock", () => {
  it("gives the focusable code scroller an accessible name", () => {
    render(
      <CodeBlock language="ts">
        <CodeBlock.Content>{"const value = 1"}</CodeBlock.Content>
      </CodeBlock>
    )

    expect(screen.getByRole("region", { name: "ts code" })).toBeInTheDocument()
    expect(screen.getByRole("region", { name: "Code content" })).toHaveAttribute("tabindex", "0")
  })

  it("has no a11y violations", async () => {
    const { container } = render(
      <CodeBlock language="ts">
        <CodeBlock.Content>{"const value = 1"}</CodeBlock.Content>
      </CodeBlock>,
    )

    expect(await axe(container)).toHaveNoViolations()
  })
})
