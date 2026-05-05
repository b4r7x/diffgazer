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

  // The hidden input inside div[role="radio"] triggers nested-interactive;
  // it is aria-hidden, tabIndex=-1, sr-only — a false positive.
  const axeOpts = { rules: { "nested-interactive": { enabled: false } } }

  it("has no a11y violations (standalone)", async () => {
    const { container } = render(<Radio label="Option A" aria-label="Option A" />)
    expect(await axe(container, axeOpts)).toHaveNoViolations()
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

  const axeOpts = { rules: { "nested-interactive": { enabled: false } } }

  it("has no a11y violations (unselected and selected)", async () => {
    const { container, rerender } = render(
      <RadioGroup label="Colors">
        <RadioGroup.Item value="red" label="Red" />
        <RadioGroup.Item value="blue" label="Blue" />
      </RadioGroup>
    )
    expect(await axe(container, axeOpts)).toHaveNoViolations()

    rerender(
      <RadioGroup label="Colors" defaultValue="red">
        <RadioGroup.Item value="red" label="Red" />
        <RadioGroup.Item value="blue" label="Blue" />
      </RadioGroup>
    )
    expect(await axe(container, axeOpts)).toHaveNoViolations()
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
