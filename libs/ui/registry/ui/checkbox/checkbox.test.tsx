import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { axe } from "../../../testing/utils.js"
import { describe, it, expect, vi } from "vitest"
import { Checkbox } from "./index.js"

// The hidden input inside div[role="checkbox"] triggers nested-interactive;
// it is aria-hidden, tabIndex=-1, sr-only — a false positive.
const axeOpts = { rules: { "nested-interactive": { enabled: false } } }

describe("Checkbox", () => {
  it("toggles on click and respects controlled value", async () => {
    const onChange = vi.fn()
    render(<Checkbox checked={false} onChange={onChange} label="Accept terms" />)
    await userEvent.click(screen.getByRole("checkbox"))
    expect(onChange).toHaveBeenCalledWith(true)
    // Controlled: DOM stays false because prop didn't change
    expect(screen.getByRole("checkbox")).toHaveAttribute("aria-checked", "false")
  })

  it("toggles on Space key", async () => {
    const onChange = vi.fn()
    render(<Checkbox onChange={onChange} label="Accept terms" />)
    screen.getByRole("checkbox").focus()
    await userEvent.keyboard(" ")
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it("does not toggle when disabled via click or keyboard", async () => {
    const onChange = vi.fn()
    render(<Checkbox disabled onChange={onChange} label="Accept terms" />)
    const checkbox = screen.getByRole("checkbox")

    await userEvent.click(checkbox)
    checkbox.focus()
    await userEvent.keyboard(" ")

    expect(onChange).not.toHaveBeenCalled()
  })

  it("renders indeterminate state as aria-checked mixed", () => {
    render(<Checkbox checked="indeterminate" label="Select all" />)
    expect(screen.getByRole("checkbox")).toHaveAttribute("aria-checked", "mixed")
  })

  it("provides accessible name from label or aria-label", () => {
    const { rerender } = render(<Checkbox label="Accept terms" />)
    expect(screen.getByRole("checkbox", { name: "Accept terms" })).toBeInTheDocument()

    rerender(<Checkbox aria-label="Accept terms" />)
    expect(screen.getByRole("checkbox", { name: "Accept terms" })).toBeInTheDocument()
  })

  it("links description via aria-describedby", () => {
    render(<Checkbox label="Accept" description="You must accept to proceed" />)
    const checkbox = screen.getByRole("checkbox")
    const descId = checkbox.getAttribute("aria-describedby")!
    expect(document.getElementById(descId)).toHaveTextContent("You must accept to proceed")
  })

  it("renders aria-invalid and aria-required when set", () => {
    render(<Checkbox invalid required label="Accept" />)
    const checkbox = screen.getByRole("checkbox")
    expect(checkbox).toHaveAttribute("aria-invalid", "true")
    expect(checkbox).toHaveAttribute("aria-required", "true")
  })

  it("has no a11y violations across states", async () => {
    const { container, rerender } = render(<Checkbox label="Accept terms" />)
    expect(await axe(container, axeOpts)).toHaveNoViolations()

    rerender(<Checkbox disabled label="Accept terms" />)
    expect(await axe(container, axeOpts)).toHaveNoViolations()

    rerender(<Checkbox checked="indeterminate" label="Select all" />)
    expect(await axe(container, axeOpts)).toHaveNoViolations()
  })
})

describe("Checkbox.Group", () => {
  it("toggles items and supports controlled value", async () => {
    const onChange = vi.fn()
    render(
      <Checkbox.Group value={["apple"]} onChange={onChange} label="Fruits">
        <Checkbox.Item value="apple" label="Apple" />
        <Checkbox.Item value="banana" label="Banana" />
      </Checkbox.Group>
    )
    expect(screen.getAllByRole("checkbox")[0]).toHaveAttribute("aria-checked", "true")
    await userEvent.click(screen.getByText("Banana"))
    expect(onChange).toHaveBeenCalledWith(["apple", "banana"])
  })

  it("sets aria-disabled on group when disabled", () => {
    render(
      <Checkbox.Group label="Fruits" disabled>
        <Checkbox.Item value="apple" label="Apple" />
      </Checkbox.Group>
    )
    expect(screen.getByRole("group")).toHaveAttribute("aria-disabled", "true")
  })

  it("navigates items with arrow keys", async () => {
    const onHighlight = vi.fn()
    render(
      <Checkbox.Group label="Fruits" onHighlightChange={onHighlight}>
        <Checkbox.Item value="apple" label="Apple" />
        <Checkbox.Item value="banana" label="Banana" />
        <Checkbox.Item value="cherry" label="Cherry" />
      </Checkbox.Group>
    )
    screen.getAllByRole("checkbox")[0].focus()
    await userEvent.keyboard("{ArrowDown}")
    expect(onHighlight).toHaveBeenCalled()
  })

  it("has no a11y violations", async () => {
    const { container } = render(
      <Checkbox.Group label="Fruits">
        <Checkbox.Item value="apple" label="Apple" />
        <Checkbox.Item value="banana" label="Banana" />
      </Checkbox.Group>
    )
    expect(await axe(container, { rules: { "nested-interactive": { enabled: false } } })).toHaveNoViolations()
  })
})
