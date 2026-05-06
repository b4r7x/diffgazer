import { render, screen, act, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { axe } from "../../../testing/utils.js"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { Tooltip } from "./index.js"

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("Tooltip", () => {
  it("renders content when defaultOpen is true", () => {
    render(
      <Tooltip content="Tip text" defaultOpen>
        <button>Hover me</button>
      </Tooltip>
    )
    expect(screen.getByRole("tooltip")).toBeInTheDocument()
    expect(screen.getByText("Tip text")).toBeInTheDocument()
  })

  it("does not open when enabled is false", () => {
    render(
      <Tooltip content="Tip text" enabled={false} delayMs={0}>
        <button>Hover me</button>
      </Tooltip>
    )
    const trigger = screen.getByText("Hover me")
    fireEvent.pointerEnter(trigger)
    fireEvent.mouseEnter(trigger)
    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()
  })

  it("has no a11y violations when open", async () => {
    vi.useRealTimers()
    const { container } = render(
      <div>
        <Tooltip content="Tip text" defaultOpen>
          <button>Hover me</button>
        </Tooltip>
      </div>
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  it("has no a11y violations when closed", async () => {
    vi.useRealTimers()
    const { container } = render(
      <div>
        <Tooltip content="Tip text">
          <button>Hover me</button>
        </Tooltip>
      </div>
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe("Tooltip keyboard", () => {
  it("shows on focus via tab", async () => {
    vi.useRealTimers()
    render(
      <Tooltip content="Tip text" delayMs={0}>
        <button>Focus me</button>
      </Tooltip>
    )

    await userEvent.tab()
    expect(screen.getByRole("tooltip")).toBeInTheDocument()
  })

  it("dismisses on Escape", async () => {
    vi.useRealTimers()
    render(
      <Tooltip content="Tip text" defaultOpen>
        <button>Hover me</button>
      </Tooltip>
    )
    expect(screen.getByRole("tooltip")).toBeInTheDocument()

    await userEvent.keyboard("{Escape}")

    expect(screen.getByRole("tooltip")).toHaveAttribute("data-state", "closed")
  })
})

describe("Tooltip trigger semantics", () => {
  it("enhances an interactive child without nesting controls", async () => {
    vi.useRealTimers()
    render(
      <Tooltip content="Tip text">
        <button>Hover me</button>
      </Tooltip>
    )
    const button = screen.getByRole("button", { name: "Hover me" })
    expect(button).toBeInTheDocument()
    expect(screen.getAllByRole("button")).toHaveLength(1)
  })

  it("wraps a disabled native trigger with a keyboard-activatable proxy", async () => {
    vi.useRealTimers()
    render(
      <Tooltip content="Disabled tip" delayMs={0}>
        <button disabled>Unavailable</button>
      </Tooltip>
    )

    const proxy = screen.getByRole("button", { name: "Unavailable" })
    expect(proxy.tagName).toBe("SPAN")

    proxy.focus()
    await userEvent.keyboard("{Enter}")
    expect(screen.getByRole("tooltip")).toBeInTheDocument()
  })
})
