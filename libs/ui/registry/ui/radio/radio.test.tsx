import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { axe } from "../../../testing/utils.js"
import { describe, it, expect, vi } from "vitest"
import { Radio, RadioGroup } from "./index.js"

describe("Radio", () => {
  it("selects on click", async () => {
    const onChange = vi.fn()
    render(<Radio onChange={onChange} label="Option A" />)
    await userEvent.click(screen.getByRole("radio"))
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it("does not toggle off on second click (radio stays selected)", async () => {
    render(<Radio defaultChecked label="Option A" />)
    const radio = screen.getByRole("radio")
    expect(radio).toHaveAttribute("aria-checked", "true")
    await userEvent.click(radio)
    expect(radio).toHaveAttribute("aria-checked", "true")
  })

  it("does not select when disabled", async () => {
    const onChange = vi.fn()
    render(<Radio disabled onChange={onChange} label="Option A" />)
    await userEvent.click(screen.getByRole("radio"))
    expect(onChange).not.toHaveBeenCalled()
  })

  it("works in uncontrolled mode with defaultChecked", async () => {
    render(<Radio defaultChecked={false} label="Option A" />)
    const radio = screen.getByRole("radio")
    expect(radio).toHaveAttribute("aria-checked", "false")
    await userEvent.click(radio)
    expect(radio).toHaveAttribute("aria-checked", "true")
  })

  it("respects controlled value", async () => {
    const onChange = vi.fn()
    render(<Radio checked={false} onChange={onChange} label="Option A" />)
    await userEvent.click(screen.getByRole("radio"))
    expect(onChange).toHaveBeenCalledWith(true)
    expect(screen.getByRole("radio")).toHaveAttribute("aria-checked", "false")
  })

  it("selects on Space key", async () => {
    const onChange = vi.fn()
    render(<Radio onChange={onChange} label="Option A" />)
    screen.getByRole("radio").focus()
    await userEvent.keyboard(" ")
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it("has no a11y violations (standalone)", async () => {
    const { container } = render(<Radio label="Option A" aria-label="Option A" />)
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe("RadioGroup", () => {
  it("selects a value on click", async () => {
    const onChange = vi.fn()
    render(
      <RadioGroup onChange={onChange} label="Colors">
        <RadioGroup.Item value="red" label="Red" />
        <RadioGroup.Item value="blue" label="Blue" />
      </RadioGroup>
    )
    await userEvent.click(screen.getByText("Blue"))
    expect(onChange).toHaveBeenCalledWith("blue")
  })

  it("does not select disabled items", async () => {
    const onChange = vi.fn()
    render(
      <RadioGroup onChange={onChange} label="Colors">
        <RadioGroup.Item value="red" label="Red" />
        <RadioGroup.Item value="blue" label="Blue" disabled />
      </RadioGroup>
    )
    await userEvent.click(screen.getByText("Blue"))
    expect(onChange).not.toHaveBeenCalled()
  })

  it("exposes one tabbable enabled item when unselected and skips disabled items", async () => {
    render(
      <RadioGroup label="Colors">
        <RadioGroup.Item value="red" label="Red" disabled />
        <RadioGroup.Item value="blue" label="Blue" />
        <RadioGroup.Item value="green" label="Green" />
      </RadioGroup>
    )

    const radios = screen.getAllByRole("radio")
    expect(radios.map((radio) => radio.getAttribute("tabindex"))).toEqual(["-1", "0", "-1"])

    await userEvent.tab()
    expect(screen.getByRole("radio", { name: /blue/i })).toHaveFocus()
  })

  it("respects controlled value", async () => {
    const onChange = vi.fn()
    render(
      <RadioGroup value="red" onChange={onChange} label="Colors">
        <RadioGroup.Item value="red" label="Red" />
        <RadioGroup.Item value="blue" label="Blue" />
      </RadioGroup>
    )
    await userEvent.click(screen.getByText("Blue"))
    expect(onChange).toHaveBeenCalledWith("blue")
    // controlled: DOM should not change
    expect(screen.getAllByRole("radio")[0]).toHaveAttribute("aria-checked", "true")
    expect(screen.getAllByRole("radio")[1]).toHaveAttribute("aria-checked", "false")
  })

  it("keeps explicit value undefined controlled instead of adopting internal selection", async () => {
    const onChange = vi.fn()
    render(
      <RadioGroup value={undefined} onChange={onChange} label="Colors">
        <RadioGroup.Item value="red" label="Red" />
        <RadioGroup.Item value="blue" label="Blue" />
      </RadioGroup>
    )

    await userEvent.click(screen.getByText("Blue"))

    expect(onChange).toHaveBeenCalledWith("blue")
    expect(screen.getAllByRole("radio")[0]).toHaveAttribute("aria-checked", "false")
    expect(screen.getAllByRole("radio")[1]).toHaveAttribute("aria-checked", "false")
  })

  it("has no a11y violations (unselected and selected)", async () => {
    const { container, rerender } = render(
      <RadioGroup label="Colors">
        <RadioGroup.Item value="red" label="Red" />
        <RadioGroup.Item value="blue" label="Blue" />
      </RadioGroup>
    )
    expect(await axe(container)).toHaveNoViolations()

    rerender(
      <RadioGroup label="Colors" defaultValue="red">
        <RadioGroup.Item value="red" label="Red" />
        <RadioGroup.Item value="blue" label="Blue" />
      </RadioGroup>
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  it("navigates with ArrowDown and wraps around", async () => {
    const onChange = vi.fn()
    render(
      <RadioGroup onChange={onChange} label="Colors">
        <RadioGroup.Item value="red" label="Red" />
        <RadioGroup.Item value="blue" label="Blue" />
        <RadioGroup.Item value="green" label="Green" />
      </RadioGroup>
    )
    screen.getAllByRole("radio")[0].focus()
    await userEvent.keyboard("{ArrowDown}")
    expect(onChange).toHaveBeenLastCalledWith("blue")
    await userEvent.keyboard("{ArrowDown}")
    expect(onChange).toHaveBeenLastCalledWith("green")
    await userEvent.keyboard("{ArrowDown}")
    expect(onChange).toHaveBeenLastCalledWith("red")
  })

  it("does not move focus to disabled radio items with arrow keys", async () => {
    const onChange = vi.fn()
    render(
      <RadioGroup onChange={onChange} label="Colors">
        <RadioGroup.Item value="red" label="Red" />
        <RadioGroup.Item value="blue" label="Blue" disabled />
        <RadioGroup.Item value="green" label="Green" />
      </RadioGroup>
    )

    screen.getByRole("radio", { name: /red/i }).focus()
    await userEvent.keyboard("{ArrowDown}")

    expect(screen.getByRole("radio", { name: /green/i })).toHaveFocus()
    expect(onChange).toHaveBeenCalledWith("green")
  })

  it("navigates with ArrowRight and ArrowLeft (APG: all four arrow keys)", async () => {
    const onChange = vi.fn()
    render(
      <RadioGroup onChange={onChange} label="Colors">
        <RadioGroup.Item value="red" label="Red" />
        <RadioGroup.Item value="blue" label="Blue" />
      </RadioGroup>
    )
    screen.getAllByRole("radio")[0].focus()
    await userEvent.keyboard("{ArrowRight}")
    expect(onChange).toHaveBeenCalledWith("blue")
    onChange.mockClear()
    await userEvent.keyboard("{ArrowLeft}")
    expect(onChange).toHaveBeenCalledWith("red")
  })
})
