import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { BlockBar } from "./index.js"
import { computeFilledCount } from "./block-bar-context.js"

describe("BlockBar", () => {
  it("clamps invalid root values before rendering meter state", () => {
    expect(() => render(<BlockBar label="Progress" max={Number.NaN} value={Number.POSITIVE_INFINITY} barWidth={Number.NaN} />)).not.toThrow()

    const meter = screen.getByRole("meter", { name: "Progress" })
    expect(meter).toHaveAttribute("aria-valuemin", "0")
    expect(meter).toHaveAttribute("aria-valuemax", "0")
    expect(meter).toHaveAttribute("aria-valuenow", "0")
    expect(meter).toHaveAttribute("aria-valuetext", "0 of 0")
  })

  it("clamps display values to the meter range", () => {
    render(<BlockBar label="Capacity" max={10} value={25} barWidth={5} />)

    const meter = screen.getByRole("meter", { name: "Capacity" })
    expect(meter).toHaveAttribute("aria-valuenow", "10")
    expect(meter).toHaveTextContent("10")
  })

  it("sanitizes segment values before drawing characters", () => {
    render(
      <BlockBar
        label="Segments"
        max={10}
        barWidth={5}
        segments={[
          { value: Number.NaN },
          { value: -5 },
          { value: 4 },
        ]}
      />,
    )

    const meter = screen.getByRole("meter", { name: "Segments" })
    expect(meter).toHaveAttribute("aria-valuenow", "4")
  })
})

describe("computeFilledCount", () => {
  it("returns zero for invalid values and widths", () => {
    expect(computeFilledCount(Number.NaN, 10, 10)).toBe(0)
    expect(computeFilledCount(5, Number.NaN, 10)).toBe(0)
    expect(computeFilledCount(5, 10, Number.NaN)).toBe(0)
  })
})
