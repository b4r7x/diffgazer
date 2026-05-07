import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { KeyValue } from "./index.js"

describe("KeyValue", () => {
  it("renders dt and dd as direct dl children", () => {
    render(
      <KeyValue>
        <KeyValue.Item label="Status" value="Ready" />
        <KeyValue.Item label="Owner" value="Docs" />
      </KeyValue>,
    )

    const list = screen.getByText("Status").closest("dl")
    expect(list).not.toBeNull()
    if (!list) return
    const children = Array.from(list.children).map((child) => child.tagName.toLowerCase())

    expect(children).toEqual(["dt", "dd", "dt", "dd"])
    expect(list.querySelector(":scope > div")).toBeNull()
  })

  it("uses a two-column grid for horizontal values", () => {
    render(
      <KeyValue layout="horizontal">
        <KeyValue.Item label="Status" value="Ready" />
      </KeyValue>,
    )

    const list = screen.getByText("Status").closest("dl")
    expect(list).toHaveClass("grid-cols-[minmax(0,1fr)_auto]")
    expect(screen.getByText("Ready")).toHaveClass("text-right")
  })

  it("applies bordered row classes across the label and value", () => {
    render(
      <KeyValue bordered>
        <KeyValue.Item label="Status" value="Ready" />
        <KeyValue.Item label="Owner" value="Docs" />
      </KeyValue>,
    )

    const firstLabel = screen.getByText("Status")
    const firstValue = screen.getByText("Ready")
    const secondLabel = screen.getByText("Owner")
    const secondValue = screen.getByText("Docs")

    expect(firstLabel).toHaveClass("border-t")
    expect(firstLabel).toHaveClass("first:border-t-0")
    expect(firstValue).toHaveClass("border-t")
    expect(firstValue).toHaveClass("[&:nth-child(2)]:border-t-0")
    expect(secondLabel).toHaveClass("border-t")
    expect(secondValue).toHaveClass("border-t")
  })
})
