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

  it("keeps the accessible label when custom segment children are provided", () => {
    render(
      <BlockBar label="Custom usage" max={10} barWidth={5}>
        <BlockBar.Segment value={20} char="x" />
      </BlockBar>,
    )

    const meter = screen.getByRole("meter", { name: "Custom usage" })
    expect(meter).toHaveAttribute("aria-valuenow", "10")
    expect(meter).toHaveAttribute("aria-valuetext", "10 of 10")
  })

  it("requires an explicit value when custom children are not segments", () => {
    expect(() => render(
      <BlockBar label="Custom usage" max={10} barWidth={5}>
        <span>custom</span>
      </BlockBar>,
    )).toThrow("BlockBar requires `value`")
  })

  it("clips drawn segments to the configured character width", () => {
    render(<BlockBar label="Clipped" max={10} value={25} barWidth={5} filledChar="x" emptyChar="_" />)

    const meter = screen.getByRole("meter", { name: "Clipped" })
    const track = meter.querySelector(".tracking-widest")
    expect(track).toHaveClass("overflow-hidden")
    expect(track).toHaveStyle({ width: "5ch" })
    expect(screen.getByText("xxxxx")).toBeInTheDocument()
  })

  it("lets segments define rendering and value when segments and children are mixed", () => {
    render(
      <BlockBar
        label="Mixed"
        max={10}
        barWidth={5}
        filledChar="x"
        emptyChar="_"
        segments={[{ value: 6 }]}
      >
        <BlockBar.Segment value={2} char="z" />
      </BlockBar>,
    )

    const meter = screen.getByRole("meter", { name: "Mixed" })

    expect(meter).toHaveAttribute("aria-valuenow", "6")
    expect(screen.getByText("xxx")).toBeInTheDocument()
    expect(screen.queryByText("z")).not.toBeInTheDocument()
  })

  it("clamps excessive bar widths before drawing", () => {
    render(<BlockBar label="Wide" max={1000} value={1000} barWidth={10000} filledChar="x" emptyChar="_" />)

    const meter = screen.getByRole("meter", { name: "Wide" })
    const track = meter.querySelector(".tracking-widest")

    expect(track).toHaveStyle({ width: "200ch" })
    expect(screen.getByText("x".repeat(200))).toBeInTheDocument()
  })
})

describe("computeFilledCount", () => {
  it("returns zero for invalid values and widths", () => {
    expect(computeFilledCount(Number.NaN, 10, 10)).toBe(0)
    expect(computeFilledCount(5, Number.NaN, 10)).toBe(0)
    expect(computeFilledCount(5, 10, Number.NaN)).toBe(0)
  })
})
