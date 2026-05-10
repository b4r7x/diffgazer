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

    const label = screen.getByText("Status")
    const value = screen.getByText("Ready")

    expect(label.tagName).toBe("DT")
    expect(value.tagName).toBe("DD")
    expect(label.nextElementSibling).toBe(value)
  })

  it("renders bordered values without wrapping label-value pairs", () => {
    render(
      <KeyValue bordered>
        <KeyValue.Item label="Status" value="Ready" />
        <KeyValue.Item label="Owner" value="Docs" />
      </KeyValue>,
    )

    const list = screen.getByText("Status").closest("dl")
    expect(list).not.toBeNull()
    if (!list) return
    const children = Array.from(list.children).map((child) => child.textContent)

    expect(children).toEqual(["Status", "Ready", "Owner", "Docs"])
  })

  it("applies label and value class slots without changing description list semantics", () => {
    render(
      <KeyValue>
        <KeyValue.Item
          label="Status"
          value="Ready"
          labelClassName="custom-label"
          valueClassName="custom-value"
        />
      </KeyValue>,
    )

    const label = screen.getByText("Status")
    const value = screen.getByText("Ready")

    expect(label.tagName).toBe("DT")
    expect(value.tagName).toBe("DD")
    expect(label).toHaveClass("custom-label")
    expect(value).toHaveClass("custom-value")
    expect(label.nextElementSibling).toBe(value)
  })
})
