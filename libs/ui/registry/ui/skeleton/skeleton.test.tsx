import { render } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { Skeleton } from "./index.js"

describe("Skeleton", () => {
  it("renders with aria-hidden", () => {
    const { container } = render(<Skeleton />)
    const el = container.firstElementChild
    expect(el).toHaveAttribute("aria-hidden", "true")
  })

  it("accepts className for dimensions", () => {
    const { container } = render(<Skeleton className="w-32 h-4" />)
    const el = container.firstElementChild
    expect(el?.className).toContain("w-32")
    expect(el?.className).toContain("h-4")
  })

  it("has pulse animation class", () => {
    const { container } = render(<Skeleton />)
    const el = container.firstElementChild
    expect(el?.className).toContain("animate-pulse")
  })

  it("applies base styling", () => {
    const { container } = render(<Skeleton />)
    const el = container.firstElementChild
    expect(el?.className).toContain("bg-secondary")
    expect(el?.className).toContain("rounded-sm")
  })

  it("spreads additional HTML attributes", () => {
    const { container } = render(<Skeleton data-testid="skel" />)
    expect(container.querySelector("[data-testid='skel']")).toBeInTheDocument()
  })
})
