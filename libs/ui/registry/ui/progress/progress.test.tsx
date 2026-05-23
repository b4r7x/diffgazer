import { render, screen } from "@testing-library/react"
import { axe } from "../../../testing/utils.js"
import { describe, it, expect } from "vitest"
import { Progress } from "./index.js"

describe("Progress", () => {
  it("renders with progressbar role and ARIA attributes", () => {
    render(<Progress value={50} aria-label="Upload progress" />)
    const bar = screen.getByRole("progressbar")
    expect(bar).toHaveAttribute("aria-valuenow", "50")
    expect(bar).toHaveAttribute("aria-valuemin", "0")
    expect(bar).toHaveAttribute("aria-valuemax", "100")
    expect(bar).toHaveAttribute("aria-label", "Upload progress")
  })

  it("clamps value between 0 and max", () => {
    const { rerender } = render(<Progress value={150} aria-label="Progress" />)
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100")

    rerender(<Progress value={-10} aria-label="Progress" />)
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0")
  })

  it("renders indeterminate mode when value is undefined", () => {
    render(<Progress aria-label="Loading" />)
    const bar = screen.getByRole("progressbar")
    expect(bar).not.toHaveAttribute("aria-valuenow")
    expect(bar).toHaveAttribute("aria-valuemin", "0")
    expect(bar).toHaveAttribute("aria-valuemax", "100")
  })

  it("supports custom max", () => {
    render(<Progress value={3} max={10} aria-label="Steps" />)
    const bar = screen.getByRole("progressbar")
    expect(bar).toHaveAttribute("aria-valuenow", "3")
    expect(bar).toHaveAttribute("aria-valuemax", "10")
  })

  it("applies size variants", () => {
    const { rerender } = render(<Progress value={50} size="sm" aria-label="Progress" />)
    const bar = screen.getByRole("progressbar")
    expect(bar.className).toContain("h-1")

    rerender(<Progress value={50} size="md" aria-label="Progress" />)
    expect(screen.getByRole("progressbar").className).toContain("h-2")
  })

  it("supports aria-labelledby", () => {
    render(
      <>
        <span id="lbl">File upload</span>
        <Progress value={75} aria-labelledby="lbl" />
      </>
    )
    expect(screen.getByRole("progressbar", { name: "File upload" })).toBeInTheDocument()
  })

  it("applies indeterminate animation class when no value", () => {
    const { container } = render(<Progress aria-label="Loading" />)
    const fill = container.querySelector("[role=progressbar] > div")
    expect(fill?.className).toContain("progress-indeterminate")
  })

  it("does not apply indeterminate animation when value is set", () => {
    const { container } = render(<Progress value={50} aria-label="Progress" />)
    const fill = container.querySelector("[role=progressbar] > div")
    expect(fill?.className).not.toContain("progress-indeterminate")
  })

  it("has no a11y violations", async () => {
    const { container, rerender } = render(<Progress value={50} aria-label="Progress" />)
    expect(await axe(container)).toHaveNoViolations()

    rerender(<Progress aria-label="Loading" />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
