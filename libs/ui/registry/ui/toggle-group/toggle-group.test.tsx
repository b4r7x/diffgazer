import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { axe } from "../../../testing/utils.js"
import { describe, it, expect, vi } from "vitest"
import { ToggleGroup } from "./index.js"

function renderGroup(props: Partial<React.ComponentProps<typeof ToggleGroup>> = {}) {
  return render(
    <ToggleGroup label="Options" {...props}>
      <ToggleGroup.Item value="a">Alpha</ToggleGroup.Item>
      <ToggleGroup.Item value="b">Beta</ToggleGroup.Item>
      <ToggleGroup.Item value="c">Charlie</ToggleGroup.Item>
    </ToggleGroup>
  )
}

function getRadios() {
  return screen.getAllByRole("radio")
}

describe("ToggleGroup", () => {
  it("selects an item on click", async () => {
    renderGroup()
    await userEvent.click(screen.getByText("Beta"))
    expect(getRadios()[1]).toHaveAttribute("aria-checked", "true")
  })

  it("does not deselect when clicking the same item without allowDeselect", async () => {
    renderGroup({ defaultValue: "a" })
    await userEvent.click(screen.getByText("Alpha"))
    expect(getRadios()[0]).toHaveAttribute("aria-checked", "true")
  })

  it("deselects when clicking the same item with allowDeselect", async () => {
    const onChange = vi.fn()
    renderGroup({ defaultValue: "a", allowDeselect: true, onChange })
    await userEvent.click(screen.getByText("Alpha"))
    expect(onChange).toHaveBeenCalledWith(null)
    expect(getRadios()[0]).toHaveAttribute("aria-checked", "false")
  })

  it("switches selection between items", async () => {
    renderGroup({ defaultValue: "a" })
    const radios = getRadios()
    expect(radios[0]).toHaveAttribute("aria-checked", "true")
    await userEvent.click(screen.getByText("Charlie"))
    expect(radios[0]).toHaveAttribute("aria-checked", "false")
    expect(radios[2]).toHaveAttribute("aria-checked", "true")
  })

  it("does not select disabled items (individual or group-level)", async () => {
    const onChange = vi.fn()
    const { unmount: unmount1 } = render(
      <ToggleGroup label="Options" onChange={onChange}>
        <ToggleGroup.Item value="a">Alpha</ToggleGroup.Item>
        <ToggleGroup.Item value="b" disabled>Beta</ToggleGroup.Item>
      </ToggleGroup>
    )
    await userEvent.click(screen.getByText("Beta"))
    expect(onChange).not.toHaveBeenCalled()
    unmount1()
    onChange.mockClear()

    render(
      <ToggleGroup label="Options" disabled onChange={onChange}>
        <ToggleGroup.Item value="a">Alpha</ToggleGroup.Item>
        <ToggleGroup.Item value="b">Beta</ToggleGroup.Item>
        <ToggleGroup.Item value="c">Charlie</ToggleGroup.Item>
      </ToggleGroup>
    )
    const radios = screen.getAllByRole("radio")
    for (const radio of radios) {
      expect(radio).toHaveAttribute("aria-disabled", "true")
    }
    await userEvent.click(screen.getByText("Alpha"))
    expect(onChange).not.toHaveBeenCalled()
  })

  it("renders count in item when provided", () => {
    render(
      <ToggleGroup label="Options">
        <ToggleGroup.Item value="a" count={5}>Alpha</ToggleGroup.Item>
      </ToggleGroup>
    )
    expect(screen.getByRole("radio")).toHaveTextContent("[Alpha 5]")
  })

  it("works in uncontrolled mode with defaultValue", async () => {
    renderGroup({ defaultValue: "b" })
    const radios = getRadios()
    expect(radios[1]).toHaveAttribute("aria-checked", "true")
    await userEvent.click(screen.getByText("Charlie"))
    expect(radios[1]).toHaveAttribute("aria-checked", "false")
    expect(radios[2]).toHaveAttribute("aria-checked", "true")
  })

  it("respects controlled value", async () => {
    const onChange = vi.fn()
    renderGroup({ value: "a", onChange })
    await userEvent.click(screen.getByText("Beta"))
    expect(onChange).toHaveBeenCalledWith("b")
    expect(getRadios()[0]).toHaveAttribute("aria-checked", "true")
    expect(getRadios()[1]).toHaveAttribute("aria-checked", "false")
  })

  it("has no a11y violations", async () => {
    const { container } = renderGroup()
    expect(await axe(container)).toHaveNoViolations()
  })

  it("has no a11y violations with a selected value", async () => {
    const { container } = renderGroup({ defaultValue: "b" })
    expect(await axe(container)).toHaveNoViolations()
  })

  it("moves focus with ArrowRight", async () => {
    renderGroup({ defaultValue: "a" })
    const radios = getRadios()
    radios[0].focus()
    await userEvent.keyboard("{ArrowRight}")
    expect(radios[1]).toHaveFocus()
  })

  it("moves focus with ArrowLeft", async () => {
    renderGroup({ defaultValue: "b" })
    const radios = getRadios()
    radios[1].focus()
    await userEvent.keyboard("{ArrowLeft}")
    expect(radios[0]).toHaveFocus()
  })

  it("wraps focus from last to first with ArrowRight", async () => {
    renderGroup({ defaultValue: "c" })
    const radios = getRadios()
    radios[2].focus()
    await userEvent.keyboard("{ArrowRight}")
    expect(radios[0]).toHaveFocus()
  })

  it("selects focused item with Enter", async () => {
    const onChange = vi.fn()
    renderGroup({ defaultValue: "a", onChange })
    const radios = getRadios()
    radios[0].focus()
    await userEvent.keyboard("{ArrowRight}")
    await userEvent.keyboard("{Enter}")
    expect(onChange).toHaveBeenCalledWith("b")
  })

  it("uses vertical arrow keys when orientation is vertical", async () => {
    renderGroup({ orientation: "vertical", defaultValue: "a" })
    const radios = getRadios()
    radios[0].focus()
    await userEvent.keyboard("{ArrowDown}")
    expect(radios[1]).toHaveFocus()
  })

  it("supports cross-axis arrow keys (ArrowUp/ArrowDown in horizontal)", async () => {
    renderGroup({ orientation: "horizontal", defaultValue: "a" })
    const radios = getRadios()
    radios[0].focus()
    await userEvent.keyboard("{ArrowDown}")
    expect(radios[1]).toHaveFocus()
  })

  it("disabled items do not activate on Enter key", async () => {
    const onChange = vi.fn()
    render(
      <ToggleGroup label="Options" onChange={onChange}>
        <ToggleGroup.Item value="a" disabled>Alpha</ToggleGroup.Item>
      </ToggleGroup>
    )
    const alpha = screen.getByRole("radio", { name: /alpha/i })
    alpha.focus()
    await userEvent.keyboard("{Enter}")
    expect(onChange).not.toHaveBeenCalled()
  })
})
