import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Divider } from "./index"

// axe skipped: aria-hidden vs role=separator semantics are asserted directly in tests below.

describe("Divider", () => {
  it("hides decorative spaced text from the accessibility tree", () => {
    const { container } = render(<Divider variant="spaced">Section</Divider>)

    expect(screen.queryByRole("separator")).not.toBeInTheDocument()
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true")
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
