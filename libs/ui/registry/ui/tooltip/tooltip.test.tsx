import { render, screen, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { axe } from "../../../testing/utils.js"
import { describe, it, expect } from "vitest"
import { Tooltip } from "./index.js"

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

  it("does not open when enabled is false", async () => {
    const user = userEvent.setup()
    render(
      <Tooltip content="Tip text" enabled={false} delayMs={0}>
        <button>Hover me</button>
      </Tooltip>
    )
    await user.hover(screen.getByText("Hover me"))
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()
  })

  it("has no a11y violations when open", async () => {
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
    render(
      <Tooltip content="Tip text" delayMs={0}>
        <button>Focus me</button>
      </Tooltip>
    )

    await userEvent.tab()
    expect(screen.getByRole("tooltip")).toBeInTheDocument()
  })

  it("dismisses on Escape", async () => {
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
  it("enhances an interactive child without nesting controls", () => {
    render(
      <Tooltip content="Tip text">
        <button>Hover me</button>
      </Tooltip>
    )
    const button = screen.getByRole("button", { name: "Hover me" })
    expect(button).toBeInTheDocument()
    expect(screen.getAllByRole("button")).toHaveLength(1)
  })

  it("does not expose passive text as a button", async () => {
    const user = userEvent.setup()
    render(
      <Tooltip content="Text tip" delayMs={0}>
        Passive text
      </Tooltip>
    )

    expect(screen.queryByRole("button", { name: "Passive text" })).not.toBeInTheDocument()

    await user.hover(screen.getByText("Passive text"))
    expect(screen.getByRole("tooltip")).toBeInTheDocument()
  })

  it("wraps a disabled native trigger without replacing its semantics", async () => {
    const user = userEvent.setup()
    render(
      <Tooltip content="Disabled tip" delayMs={0}>
        <button disabled>Unavailable</button>
      </Tooltip>
    )

    const button = screen.getByRole("button", { name: "Unavailable" })
    const wrapper = button.parentElement as HTMLElement
    expect(button).toBeDisabled()
    expect(screen.getAllByRole("button")).toHaveLength(1)
    expect(wrapper).not.toHaveAttribute("role")
    expect(wrapper).not.toHaveAttribute("tabindex")

    await user.hover(wrapper)
    expect(screen.getByRole("tooltip")).toBeInTheDocument()
  })
})

describe("Tooltip touch", () => {
  it("reveals on touch tap of passive trigger and hides on second tap", () => {
    render(
      <Tooltip content="Tip text">
        Passive label
      </Tooltip>
    )
    const trigger = screen.getByText("Passive label")
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()

    // fireEvent retained: pointerType is required to distinguish touch from mouse; user-event cannot set it
    fireEvent.pointerDown(trigger, { pointerType: "touch" })
    expect(screen.getByRole("tooltip")).toHaveAttribute("data-state", "open")

    // fireEvent retained: same pointerType signal closes the tooltip
    fireEvent.pointerDown(trigger, { pointerType: "touch" })
    expect(screen.getByRole("tooltip")).toHaveAttribute("data-state", "closed")
  })

  it("dismisses on outside tap", () => {
    render(
      <div>
        <button>Outside</button>
        <Tooltip content="Tip text" defaultOpen>
          Passive label
        </Tooltip>
      </div>
    )
    expect(screen.getByRole("tooltip")).toHaveAttribute("data-state", "open")

    // fireEvent retained: document-level pointerdown listener attaches in capture phase
    fireEvent.pointerDown(screen.getByRole("button", { name: "Outside" }))
    expect(screen.getByRole("tooltip")).toHaveAttribute("data-state", "closed")
  })
})
