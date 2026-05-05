import { render, screen, act, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { axe } from "../../../testing/utils.js"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { Popover } from "./index.js"

function renderClickPopover(props: Record<string, unknown> = {}) {
  return render(
    <Popover triggerMode="click" {...props}>
      <Popover.Trigger>Open</Popover.Trigger>
      <Popover.Content aria-label="Popover menu">Popover body</Popover.Content>
    </Popover>
  )
}

describe("Popover", () => {
  it("opens on click and closes on second click", async () => {
    renderClickPopover()
    const trigger = screen.getByRole("button", { name: "Open" })

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()

    await userEvent.click(trigger)
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(trigger).toHaveAttribute("aria-expanded", "true")

    await userEvent.click(trigger)
    expect(trigger).toHaveAttribute("aria-expanded", "false")
  })

  it("calls onOpenChange when toggled via click", async () => {
    const onOpenChange = vi.fn()
    renderClickPopover({ onOpenChange })
    await userEvent.click(screen.getByRole("button", { name: "Open" }))
    expect(onOpenChange).toHaveBeenCalledWith(true)
  })

  describe("hover trigger with delay", () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it("opens after delay on mouse enter", () => {
      render(
        <Popover triggerMode="hover" delayMs={200}>
          <Popover.Trigger>Hover me</Popover.Trigger>
          <Popover.Content>Tooltip body</Popover.Content>
        </Popover>
      )
      const trigger = screen.getByText("Hover me")

      fireEvent.mouseEnter(trigger)

      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()

      act(() => {
        vi.advanceTimersByTime(200)
      })

      expect(screen.getByRole("tooltip")).toBeInTheDocument()
    })

    it("closes after closeDelay on mouse leave", () => {
      render(
        <Popover triggerMode="hover" delayMs={200} closeDelayMs={100}>
          <Popover.Trigger>Hover me</Popover.Trigger>
          <Popover.Content>Tooltip body</Popover.Content>
        </Popover>
      )
      const trigger = screen.getByText("Hover me")

      fireEvent.mouseEnter(trigger)
      act(() => {
        vi.advanceTimersByTime(200)
      })
      expect(screen.getByRole("tooltip")).toBeInTheDocument()

      fireEvent.mouseLeave(trigger)
      act(() => {
        vi.advanceTimersByTime(100)
      })

      expect(screen.getByRole("tooltip")).toHaveAttribute("data-state", "closed")
    })

    it("cancels open timer if mouse leaves before delay elapses", () => {
      render(
        <Popover triggerMode="hover" delayMs={200}>
          <Popover.Trigger>Hover me</Popover.Trigger>
          <Popover.Content>Tooltip body</Popover.Content>
        </Popover>
      )
      const trigger = screen.getByText("Hover me")

      fireEvent.mouseEnter(trigger)
      act(() => {
        vi.advanceTimersByTime(100)
      })
      fireEvent.mouseLeave(trigger)
      act(() => {
        vi.advanceTimersByTime(200)
      })

      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()
    })
  })

  it("respects controlled open prop", async () => {
    const onOpenChange = vi.fn()
    const { rerender } = render(
      <Popover open={false} onOpenChange={onOpenChange}>
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Content aria-label="Popover menu">Popover body</Popover.Content>
      </Popover>
    )

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Open" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(onOpenChange).toHaveBeenCalled()

    rerender(
      <Popover open={true} onOpenChange={onOpenChange}>
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Content aria-label="Popover menu">Popover body</Popover.Content>
      </Popover>
    )
    expect(screen.getByRole("dialog")).toBeInTheDocument()
  })

  it("has no a11y violations when closed", async () => {
    const { container } = renderClickPopover()
    expect(await axe(container)).toHaveNoViolations()
  })

  it("has no a11y violations when open with aria-label", async () => {
    const { container } = renderClickPopover({ defaultOpen: true })
    expect(await axe(container)).toHaveNoViolations()
  })

  it("closes on Escape and restores focus to trigger", async () => {
    renderClickPopover({ defaultOpen: true })
    const trigger = screen.getByRole("button", { name: "Open" })

    await userEvent.keyboard("{Escape}")

    expect(trigger).toHaveAttribute("aria-expanded", "false")
    expect(trigger).toHaveFocus()
  })

  it("does not open when enabled is false", async () => {
    renderClickPopover({ enabled: false })
    await userEvent.click(screen.getByRole("button", { name: "Open" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("closes when enabled changes to false while open", () => {
    const { rerender } = render(
      <Popover defaultOpen enabled>
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Content aria-label="Popover menu">Popover body</Popover.Content>
      </Popover>
    )
    expect(screen.getByRole("dialog")).toBeInTheDocument()

    rerender(
      <Popover defaultOpen enabled={false}>
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Content aria-label="Popover menu">Popover body</Popover.Content>
      </Popover>
    )
    expect(screen.getByRole("dialog")).toHaveAttribute("data-state", "closed")
  })
})

describe("Popover hover-mode trigger click toggle", () => {
  it("clicking a hover-mode trigger toggles popover open and closed", async () => {
    render(
      <Popover triggerMode="hover">
        <Popover.Trigger>Hover me</Popover.Trigger>
        <Popover.Content>
          <p>Tooltip content</p>
        </Popover.Content>
      </Popover>
    )
    const trigger = screen.getByText("Hover me")

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()

    await userEvent.click(trigger)
    expect(screen.getByRole("tooltip")).toHaveAttribute("data-state", "open")

    await userEvent.click(trigger)
    expect(screen.getByRole("tooltip")).toHaveAttribute("data-state", "closed")
  })
})

function renderClickPopoverWithFocusables() {
  return render(
    <Popover triggerMode="click" defaultOpen>
      <Popover.Trigger>Open</Popover.Trigger>
      <Popover.Content aria-label="Actions">
        <button>First</button>
        <button>Second</button>
        <button>Third</button>
      </Popover.Content>
    </Popover>
  )
}

describe("Popover keyboard focus trap", () => {
  beforeEach(() => {
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0)
      return 0
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("Tab cycles within click-mode popover content", async () => {
    renderClickPopoverWithFocusables()
    const first = screen.getByRole("button", { name: "First" })
    const second = screen.getByRole("button", { name: "Second" })
    const third = screen.getByRole("button", { name: "Third" })

    expect(first).toHaveFocus()

    await userEvent.tab()
    expect(second).toHaveFocus()

    await userEvent.tab()
    expect(third).toHaveFocus()

    await userEvent.tab()
    expect(first).toHaveFocus()
  })

  it("Shift+Tab wraps from first to last element", async () => {
    renderClickPopoverWithFocusables()
    const first = screen.getByRole("button", { name: "First" })
    const third = screen.getByRole("button", { name: "Third" })

    expect(first).toHaveFocus()

    await userEvent.tab({ shift: true })
    expect(third).toHaveFocus()
  })
})
