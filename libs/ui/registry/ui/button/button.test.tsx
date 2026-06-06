import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { axe } from "../../../testing/axe"
import type { ButtonRenderProps } from "./button"
import { Button } from "./index"

describe("Button", () => {
  it("renders as a button element by default", () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument()
  })

  it("fires onClick when clicked", async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Click</Button>)
    await userEvent.click(screen.getByRole("button"))
    expect(onClick).toHaveBeenCalled()
  })

  it("renders as an anchor when as='a'", () => {
    render(<Button as="a" href="/test">Link</Button>)
    const link = screen.getByRole("link", { name: "Link" })
    expect(link).toHaveAttribute("href", "/test")
  })

  it("shows loading state with aria-busy and a data-loading hook", () => {
    render(<Button loading>Save</Button>)
    const btn = screen.getByRole("button")
    expect(btn).toHaveAttribute("aria-busy", "true")
    expect(btn).toHaveAttribute("data-loading", "true")
    expect(btn).toBeDisabled()
  })

  it("renders the spinner indicator after the lazy chunk resolves", async () => {
    render(<Button loading>Save</Button>)
    const btn = screen.getByRole("button")
    // querySelector: Spinner is wrapped in aria-hidden so it is excluded from
    // the accessibility tree; this structural assertion confirms the lazy
    // Suspense fallback resolved and the spinner mounted inside the button.
    await waitFor(() => {
      expect(btn.querySelector('[role="status"][aria-label="Loading"]')).not.toBeNull()
    })
    expect(screen.getByText("Save")).toHaveClass("sr-only")
  })

  it("is disabled when disabled prop is true", () => {
    render(<Button disabled>Save</Button>)
    expect(screen.getByRole("button")).toBeDisabled()
  })

  it("prevents disabled anchor navigation without firing consumer clicks", () => {
    const spy = vi.fn()
    render(<Button as="a" href="/test" disabled onClick={spy}>Link</Button>)
    const link = screen.getByRole("link")
    const event = new MouseEvent("click", { bubbles: true, cancelable: true })

    link.dispatchEvent(event)

    expect(spy).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(true)
  })

  it("removes a disabled anchor from the tab order and makes it non-navigable", async () => {
    render(
      <>
        <Button as="a" href="/before">Before</Button>
        <Button as="a" href="/test" disabled>Link</Button>
        <Button as="a" href="/after">After</Button>
      </>,
    )
    const disabled = screen.getByRole("link", { name: "Link" })
    expect(disabled).toHaveAttribute("aria-disabled", "true")
    expect(disabled).toHaveAttribute("tabindex", "-1")
    expect(disabled).not.toHaveAttribute("href")

    screen.getByRole("link", { name: "Before" }).focus()
    await userEvent.tab()

    expect(screen.getByRole("link", { name: "After" })).toHaveFocus()
    expect(disabled).not.toHaveFocus()
  })

  it("keeps a consumer tabIndex on an enabled anchor but forces -1 when disabled", () => {
    // biome-ignore lint/a11y/noPositiveTabindex: the test deliberately passes a positive tabIndex to assert the Button forwards a consumer-provided value.
    const { rerender } = render(<Button as="a" href="/test" tabIndex={3}>Link</Button>)
    expect(screen.getByRole("link")).toHaveAttribute("tabindex", "3")

    // biome-ignore lint/a11y/noPositiveTabindex: the test deliberately passes a positive tabIndex to assert it is overridden to -1 when disabled.
    rerender(<Button as="a" href="/test" tabIndex={3} disabled>Link</Button>)
    expect(screen.getByRole("link")).toHaveAttribute("tabindex", "-1")
  })

  it("renders bracket decoration when bracket is true", () => {
    render(<Button bracket>Action</Button>)
    const btn = screen.getByRole("button")
    expect(btn.textContent).toContain("[")
    expect(btn.textContent).toContain("]")
  })

  it("supports render prop children", () => {
    render(
      <Button variant="primary">
        {(props: ButtonRenderProps) => <div className={props.className}>Custom</div>}
      </Button>
    )
    expect(screen.getByText("Custom")).toBeInTheDocument()
  })

  it("has no a11y violations", async () => {
    const { container } = render(<Button>Click me</Button>)
    expect(await axe(container)).toHaveNoViolations()
  })

  it("has no a11y violations as anchor", async () => {
    const { container } = render(<Button as="a" href="/test">Link</Button>)
    expect(await axe(container)).toHaveNoViolations()
  })
})
