import { render, screen } from "@testing-library/react"
import { axe } from "../../../testing/utils.js"
import { describe, it, expect } from "vitest"
import { Spinner } from "./index.js"

describe("Spinner", () => {
  it("renders with role=status and default label when no children", () => {
    render(<Spinner />)
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument()
  })

  it("renders with role=status and no aria-label when children are provided", () => {
    render(<Spinner>Processing...</Spinner>)
    const status = screen.getByRole("status")
    expect(status).not.toHaveAttribute("aria-label")
    expect(status).toHaveTextContent("Processing...")
  })

  it("has no a11y violations", async () => {
    const { container } = render(<Spinner />)
    expect(await axe(container)).toHaveNoViolations()
  })

  it("has no a11y violations with children", async () => {
    const { container } = render(<Spinner>Loading data...</Spinner>)
    expect(await axe(container)).toHaveNoViolations()
  })
})
