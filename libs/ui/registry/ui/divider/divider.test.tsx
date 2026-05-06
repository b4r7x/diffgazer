import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Divider } from "./index.js"

describe("Divider", () => {
  it("hides decorative spaced text from the accessibility tree", () => {
    render(<Divider variant="spaced">Section</Divider>)

    expect(screen.getByText("Section").closest("div")).toHaveAttribute("aria-hidden", "true")
  })

  it("exposes meaningful separators when decorative is false", () => {
    render(
      <Divider decorative={false} orientation="vertical" variant="spaced">
        Section
      </Divider>,
    )

    const separator = screen.getByRole("separator")
    expect(separator).toHaveAttribute("aria-orientation", "vertical")
    expect(screen.getByText("Section")).toBeInTheDocument()
  })
})
