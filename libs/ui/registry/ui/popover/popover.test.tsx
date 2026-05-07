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

let restorePointerEventSupport = () => {}

function setPointerEventSupport(enabled: boolean) {
  const descriptor = Object.getOwnPropertyDescriptor(window, "PointerEvent")

  Object.defineProperty(window, "PointerEvent", {
    configurable: true,
    writable: true,
    value: enabled ? class TestPointerEvent extends MouseEvent {} : undefined,
  })

  return () => {
    if (descriptor) {
      Object.defineProperty(window, "PointerEvent", descriptor)
    } else {
      Reflect.deleteProperty(window, "PointerEvent")
    }
  }
}

beforeEach(() => {
  restorePointerEventSupport = setPointerEventSupport(false)
})

afterEach(() => {
  restorePointerEventSupport()
})

describe("Popover", () => {
  it("opens on click and closes on second click", async () => {
    renderClickPopover()
    const trigger = screen.getByRole("button", { name: "Open" })

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(trigger).not.toHaveAttribute("aria-haspopup")

    await userEvent.click(trigger)
    expect(screen.getByText("Popover body")).toBeInTheDocument()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(trigger).toHaveAttribute("aria-expanded", "true")

    await userEvent.click(trigger)
    expect(trigger).toHaveAttribute("aria-expanded", "false")
  })

  it.each(["menu", "listbox", "grid", "tree", "dialog"] as const)(
    "sets aria-haspopup for click popovers with %s content",
    (role) => {
      render(
        <Popover triggerMode="click" defaultOpen>
          <Popover.Trigger>Open</Popover.Trigger>
          <Popover.Content role={role} aria-label={`${role} popup`}>
            Popover body
          </Popover.Content>
        </Popover>
      )

      const trigger = screen.getByRole("button", { name: "Open" })
      const content = screen.getByRole(role, { name: `${role} popup` })
      expect(trigger).toHaveAttribute("aria-haspopup", role)
      expect(trigger).toHaveAttribute("aria-controls", content.id)
    },
  )

  it("derives aria-haspopup from content role before the popup opens", () => {
    render(
      <Popover triggerMode="click">
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Content role="menu" aria-label="Actions">
          Popover body
        </Popover.Content>
      </Popover>
    )

    expect(screen.getByRole("button", { name: "Open" })).toHaveAttribute("aria-haspopup", "menu")
    expect(screen.queryByRole("menu", { name: "Actions" })).not.toBeInTheDocument()
  })

  it("can declare click popup role on the root before content effects run", () => {
    render(
      <Popover triggerMode="click" popupRole="menu">
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Content role="menu" aria-label="Actions">
          Popover body
        </Popover.Content>
      </Popover>
    )

    expect(screen.getByRole("button", { name: "Open" })).toHaveAttribute("aria-haspopup", "menu")
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

      const tooltip = screen.getByRole("tooltip")
      expect(tooltip).toBeInTheDocument()
      expect(trigger).not.toHaveAttribute("aria-haspopup")
      expect(trigger).toHaveAttribute("aria-describedby", tooltip.id)
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

    expect(screen.queryByText("Popover body")).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Open" }))
    expect(screen.queryByText("Popover body")).not.toBeInTheDocument()
    expect(onOpenChange).toHaveBeenCalled()

    rerender(
      <Popover open={true} onOpenChange={onOpenChange}>
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Content aria-label="Popover menu">Popover body</Popover.Content>
      </Popover>
    )
    expect(screen.getByText("Popover body")).toBeInTheDocument()
  })

  it("has no a11y violations when closed", async () => {
    const { container } = renderClickPopover()
    expect(await axe(container)).toHaveNoViolations()
  })

  it("has no a11y violations when open with aria-label", async () => {
    const { container } = renderClickPopover({ defaultOpen: true })
    expect(await axe(container)).toHaveNoViolations()
  })

  it("uses an interactive child as the click trigger without nesting controls", async () => {
    const { container } = render(
      <Popover triggerMode="click">
        <Popover.Trigger>
          <button type="button">Open child</button>
        </Popover.Trigger>
        <Popover.Content aria-label="Popover menu">Popover body</Popover.Content>
      </Popover>
    )

    const trigger = screen.getByRole("button", { name: "Open child" })
    expect(container.querySelector("button button")).toBeNull()
    expect(await axe(container)).toHaveNoViolations()

    await userEvent.click(trigger)
    expect(screen.getByText("Popover body")).toBeInTheDocument()
    expect(trigger).toHaveAttribute("aria-expanded", "true")
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
    expect(screen.queryByText("Popover body")).not.toBeInTheDocument()
  })

  it("closes when enabled changes to false while open", () => {
    const { rerender } = render(
      <Popover defaultOpen enabled>
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Content aria-label="Popover menu">Popover body</Popover.Content>
      </Popover>
    )
    expect(screen.getByText("Popover body")).toBeInTheDocument()

    rerender(
      <Popover defaultOpen enabled={false}>
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Content aria-label="Popover menu">Popover body</Popover.Content>
      </Popover>
    )
    expect(screen.getByText("Popover body")).toHaveAttribute("data-state", "closed")
  })

  it("closes only the top nested popover on outside click and Escape", async () => {
    render(
      <div>
        <button>Outside</button>
        <Popover defaultOpen>
          <Popover.Trigger>Outer</Popover.Trigger>
          <Popover.Content role="dialog" aria-label="Outer popover">
            <Popover defaultOpen>
              <Popover.Trigger>Inner</Popover.Trigger>
              <Popover.Content role="dialog" aria-label="Inner popover">Inner body</Popover.Content>
            </Popover>
          </Popover.Content>
        </Popover>
      </div>
    )

    const outside = screen.getByRole("button", { name: "Outside" })
    expect(screen.getByRole("dialog", { name: "Outer popover" })).toHaveAttribute("data-state", "open")
    expect(screen.getByRole("dialog", { name: "Inner popover" })).toHaveAttribute("data-state", "open")

    fireEvent.mouseDown(outside)
    expect(screen.getByRole("dialog", { name: "Inner popover" })).toHaveAttribute("data-state", "closed")
    expect(screen.getByRole("dialog", { name: "Outer popover" })).toHaveAttribute("data-state", "open")

    fireEvent.animationEnd(screen.getByRole("dialog", { name: "Inner popover" }))
    await userEvent.keyboard("{Escape}")
    expect(screen.getByRole("dialog", { name: "Outer popover" })).toHaveAttribute("data-state", "closed")
  })

  it("closes on pointer and touch outside interactions", () => {
    restorePointerEventSupport()
    restorePointerEventSupport = setPointerEventSupport(true)
    const { rerender } = render(
      <div>
        <button>Outside</button>
        <Popover defaultOpen key="pointer">
          <Popover.Trigger>Open</Popover.Trigger>
          <Popover.Content>Popover body</Popover.Content>
        </Popover>
      </div>,
    )
    const outside = screen.getByRole("button", { name: "Outside" })

    fireEvent.pointerDown(outside)
    expect(screen.getByText("Popover body")).toHaveAttribute("data-state", "closed")

    restorePointerEventSupport()
    restorePointerEventSupport = setPointerEventSupport(false)

    rerender(
      <div>
        <button>Outside</button>
        <Popover defaultOpen key="touch">
          <Popover.Trigger>Open</Popover.Trigger>
          <Popover.Content>Popover body</Popover.Content>
        </Popover>
      </div>,
    )

    fireEvent.touchStart(screen.getByRole("button", { name: "Outside" }))
    expect(screen.getByText("Popover body")).toHaveAttribute("data-state", "closed")
  })

  it("requires an accessible name for dialog popovers", () => {
    expect(() => render(
      <Popover defaultOpen>
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Content role="dialog">Popover body</Popover.Content>
      </Popover>,
    )).toThrow(/requires aria-label or aria-labelledby/)
  })

  it("composes content handlers and lets prevented Escape keep the popover open", () => {
    const onMouseEnter = vi.fn()
    const onMouseLeave = vi.fn()
    const onKeyDown = vi.fn((event) => {
      if (event.key === "Escape") event.preventDefault()
    })

    render(
      <Popover triggerMode="click" defaultOpen>
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Content
          role="dialog"
          aria-label="Actions"
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          onKeyDown={onKeyDown}
        >
          Popover body
        </Popover.Content>
      </Popover>,
    )

    const content = screen.getByRole("dialog", { name: "Actions" })
    fireEvent.mouseEnter(content)
    fireEvent.mouseLeave(content)
    fireEvent.keyDown(content, { key: "Escape" })

    expect(onMouseEnter).toHaveBeenCalledOnce()
    expect(onMouseLeave).toHaveBeenCalledOnce()
    expect(onKeyDown).toHaveBeenCalledOnce()
    expect(content).toHaveAttribute("data-state", "open")
  })
})

describe("Popover hover-mode trigger click toggle", () => {
  it("clicking an interactive hover-mode trigger toggles popover open and closed", async () => {
    render(
      <Popover triggerMode="hover">
        <Popover.Trigger>
          <button type="button">Hover me</button>
        </Popover.Trigger>
        <Popover.Content>
          <p>Tooltip content</p>
        </Popover.Content>
      </Popover>
    )
    const trigger = screen.getByRole("button", { name: "Hover me" })

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()
    expect(trigger).not.toHaveAttribute("aria-haspopup")

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
      <Popover.Content role="dialog" aria-label="Actions">
        <button>First</button>
        <button>Second</button>
        <button>Third</button>
      </Popover.Content>
    </Popover>
  )
}

describe("Popover dialog focus", () => {
  beforeEach(() => {
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0)
      return 0
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("does not trap Tab within click-mode dialog content", async () => {
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
    expect(first).not.toHaveFocus()
  })

  it("Shift+Tab can leave from the first element", async () => {
    renderClickPopoverWithFocusables()
    const first = screen.getByRole("button", { name: "First" })

    expect(first).toHaveFocus()

    await userEvent.tab({ shift: true })
    expect(first).not.toHaveFocus()
  })
})

describe("Popover non-modal focus", () => {
  it("does not trap Tab in default click-mode content", async () => {
    render(
      <Popover triggerMode="click" defaultOpen>
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Content>
          <button>First</button>
          <button>Second</button>
        </Popover.Content>
      </Popover>,
    )
    const first = screen.getByRole("button", { name: "First" })
    const second = screen.getByRole("button", { name: "Second" })
    first.focus()

    await userEvent.tab()
    expect(second).toHaveFocus()

    await userEvent.tab()
    expect(first).not.toHaveFocus()
  })
})

describe("Popover hover timer cleanup", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("clears pending hover timers on unmount", () => {
    const onOpenChange = vi.fn()
    const { unmount } = render(
      <Popover triggerMode="hover" delayMs={200} onOpenChange={onOpenChange}>
        <Popover.Trigger>Hover me</Popover.Trigger>
        <Popover.Content>Tooltip body</Popover.Content>
      </Popover>,
    )

    fireEvent.mouseEnter(screen.getByText("Hover me"))
    unmount()
    act(() => {
      vi.advanceTimersByTime(200)
    })

    expect(onOpenChange).not.toHaveBeenCalled()
  })
})
