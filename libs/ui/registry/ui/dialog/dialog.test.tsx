import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { axe } from "../../../testing/utils.js"
import { afterEach, afterAll, beforeAll, beforeEach, describe, it, expect, vi } from "vitest"
import { useState, type ReactNode } from "react"
import { renderToString } from "react-dom/server"
import { Dialog } from "./index.js"
import { Popover } from "../popover/index.js"

afterEach(() => {
  vi.restoreAllMocks()
})

function renderDialog(props: { open?: boolean; defaultOpen?: boolean; onOpenChange?: (open: boolean) => void } = {}) {
  return render(
    <Dialog {...props}>
      <Dialog.Trigger>Open</Dialog.Trigger>
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>Test Title</Dialog.Title>
          <Dialog.Close />
        </Dialog.Header>
        <Dialog.Description>Test description</Dialog.Description>
        <Dialog.Body>Body content</Dialog.Body>
        <Dialog.Footer>
          <Dialog.Action>Confirm</Dialog.Action>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  )
}

// Backdrop click logic compares the click coordinate to the dialog's bounding rect.
// jsdom layout is 0x0, so mock the rect so a click at (80,120) is "outside" and (200,200) is "inside".
function mockDialogBounds(dialog: HTMLElement) {
  vi.spyOn(dialog, "getBoundingClientRect").mockReturnValue({
    x: 100,
    y: 100,
    width: 320,
    height: 240,
    top: 100,
    right: 420,
    bottom: 340,
    left: 100,
    toJSON() {},
  })
}

describe("Dialog", () => {
  it("opens when trigger is clicked and calls onOpenChange in controlled mode", async () => {
    const onOpenChange = vi.fn()
    renderDialog({ open: false, onOpenChange })
    await userEvent.click(screen.getByRole("button", { name: "Open" }))
    expect(onOpenChange).toHaveBeenCalledWith(true)
  })

  it("closes when close button is clicked", async () => {
    renderDialog({ defaultOpen: true })
    const dialog = screen.getByRole("dialog")
    expect(dialog).toHaveAttribute("data-state", "open")
    await userEvent.click(screen.getByRole("button", { name: "Close dialog" }))
    expect(dialog).toHaveAttribute("data-state", "closed")
  })

  it("closes on Escape key via cancel event", () => {
    renderDialog({ defaultOpen: true })
    const dialog = screen.getByRole("dialog")
    expect(dialog).toHaveAttribute("data-state", "open")
    // fireEvent retained: native <dialog> cancel event has no user-event equivalent
    fireEvent(dialog, new Event("cancel", { bubbles: false }))
    expect(dialog).toHaveAttribute("data-state", "closed")
  })

  it("closes on backdrop click", async () => {
    const onOpenChange = vi.fn()
    render(
      <Dialog defaultOpen onOpenChange={onOpenChange}>
        <Dialog.Trigger>Open Dialog</Dialog.Trigger>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>Test</Dialog.Title>
          </Dialog.Header>
          <button>Inside Button</button>
          <Dialog.Close />
        </Dialog.Content>
      </Dialog>
    )
    const dialog = screen.getByRole("dialog")
    mockDialogBounds(dialog)

    // fireEvent retained: backdrop close requires explicit clientX/clientY to land outside dialog bounds
    fireEvent.click(dialog, { clientX: 80, clientY: 120 })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("does not close when a dialog-target click lands inside the dialog bounds", () => {
    const onOpenChange = vi.fn()
    render(
      <Dialog defaultOpen onOpenChange={onOpenChange}>
        <Dialog.Trigger>Open Dialog</Dialog.Trigger>
        <Dialog.Content>
          <Dialog.Title>Bounded dialog</Dialog.Title>
        </Dialog.Content>
      </Dialog>
    )

    const dialog = screen.getByRole("dialog", { name: "Bounded dialog" })
    mockDialogBounds(dialog)

    // fireEvent retained: backdrop logic needs clientX/clientY to evaluate inside-vs-outside
    fireEvent.click(dialog, { clientX: 200, clientY: 200 })

    expect(onOpenChange).not.toHaveBeenCalled()
    expect(dialog).toHaveAttribute("data-state", "open")
  })

  it("keeps closeOnBackdropClick=false semantics for outside backdrop clicks", () => {
    const onOpenChange = vi.fn()
    render(
      <Dialog defaultOpen onOpenChange={onOpenChange}>
        <Dialog.Trigger>Open Dialog</Dialog.Trigger>
        <Dialog.Content closeOnBackdropClick={false}>
          <Dialog.Title>Static dialog</Dialog.Title>
        </Dialog.Content>
      </Dialog>
    )

    const dialog = screen.getByRole("dialog", { name: "Static dialog" })
    mockDialogBounds(dialog)

    // fireEvent retained: backdrop click needs explicit coordinates outside dialog bounds
    fireEvent.click(dialog, { clientX: 80, clientY: 120 })

    expect(onOpenChange).not.toHaveBeenCalled()
    expect(dialog).toHaveAttribute("data-state", "open")
  })

  it("returns focus to trigger after dialog closes", () => {
    const { rerender } = renderDialog({ defaultOpen: true })
    const trigger = screen.getByRole("button", { name: "Open" })
    trigger.focus()

    rerender(
      <Dialog open={false}>
        <Dialog.Trigger>Open</Dialog.Trigger>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>Test Title</Dialog.Title>
            <Dialog.Close />
          </Dialog.Header>
        </Dialog.Content>
      </Dialog>
    )

    // querySelector retained: the native <dialog> element drives the close-transition; the test needs the raw element to fire animationEnd against (the dialog role disappears once it begins closing)
    const dialog = document.querySelector("dialog")
    // fireEvent retained: animationend has no user-event equivalent; presence transitions complete on this event
    if (dialog) fireEvent.animationEnd(dialog)

    expect(trigger).toHaveFocus()
  })

  it("returns focus to the previously focused element without DialogTrigger", async () => {
    function ControlledDialog() {
      const [open, setOpen] = useState(false)

      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>Open controlled dialog</button>
          <Dialog open={open} onOpenChange={setOpen}>
            <Dialog.Content>
              <Dialog.Title>Controlled dialog</Dialog.Title>
              <Dialog.Close />
            </Dialog.Content>
          </Dialog>
        </>
      )
    }

    render(<ControlledDialog />)
    const opener = screen.getByRole("button", { name: "Open controlled dialog" })

    await userEvent.click(opener)
    const dialog = screen.getByRole("dialog", { name: "Controlled dialog" })
    await userEvent.click(screen.getByRole("button", { name: "Close dialog" }))
    await waitFor(() => expect(dialog).toHaveAttribute("data-state", "closed"))
    // fireEvent retained: animationend has no user-event equivalent
    fireEvent.animationEnd(dialog)

    await waitFor(() => expect(opener).toHaveFocus())
  })

  it("restores focus in close order for nested triggerless dialogs", async () => {
    function NestedDialogs() {
      const [parentOpen, setParentOpen] = useState(false)
      const [childOpen, setChildOpen] = useState(false)

      return (
        <>
          <button type="button" onClick={() => setParentOpen(true)}>Open parent</button>
          <Dialog open={parentOpen} onOpenChange={setParentOpen}>
            <Dialog.Content>
              <Dialog.Title>Parent dialog</Dialog.Title>
              <button type="button" onClick={() => setChildOpen(true)}>Open child</button>
              <Dialog.Close>Close parent</Dialog.Close>
            </Dialog.Content>
          </Dialog>
          <Dialog open={childOpen} onOpenChange={setChildOpen}>
            <Dialog.Content>
              <Dialog.Title>Child dialog</Dialog.Title>
              <Dialog.Close>Close child</Dialog.Close>
            </Dialog.Content>
          </Dialog>
        </>
      )
    }

    render(<NestedDialogs />)
    const opener = screen.getByRole("button", { name: "Open parent" })

    await userEvent.click(opener)
    const childOpener = screen.getByRole("button", { name: "Open child" })
    await userEvent.click(childOpener)

    const childDialog = screen.getByRole("dialog", { name: "Child dialog" })
    await userEvent.click(screen.getByRole("button", { name: "Close child" }))
    await waitFor(() => expect(childDialog).toHaveAttribute("data-state", "closed"))
    // fireEvent retained: animationend has no user-event equivalent
    fireEvent.animationEnd(childDialog)
    await waitFor(() => expect(childOpener).toHaveFocus())

    const parentDialog = screen.getByRole("dialog", { name: "Parent dialog" })
    await userEvent.click(screen.getByRole("button", { name: "Close parent" }))
    await waitFor(() => expect(parentDialog).toHaveAttribute("data-state", "closed"))
    // fireEvent retained: animationend has no user-event equivalent
    fireEvent.animationEnd(parentDialog)
    await waitFor(() => expect(opener).toHaveFocus())
  })

  it("keeps a closing dialog closed while it remains present for exit animation", () => {
    const { rerender } = renderDialog({ defaultOpen: true })
    const dialog = screen.getByRole("dialog") as HTMLDialogElement

    dialog.close()

    rerender(
      <Dialog open={false}>
        <Dialog.Trigger>Open</Dialog.Trigger>
        <Dialog.Content>
          <Dialog.Title>Closing dialog</Dialog.Title>
        </Dialog.Content>
      </Dialog>
    )

    expect(dialog).toHaveAttribute("data-state", "closed")
    expect(dialog).not.toHaveAttribute("open")
  })

  it("keeps nested portals inside a dialog opened after an initial closed render", async () => {
    function ClosedFirstDialog() {
      const [open, setOpen] = useState(false)

      return (
        <Dialog open={open} onOpenChange={setOpen}>
          <Dialog.Trigger>Open delayed dialog</Dialog.Trigger>
          <Dialog.Content>
            <Dialog.Title>Delayed dialog</Dialog.Title>
            <Popover triggerMode="click" defaultOpen>
              <Popover.Trigger>Nested popover trigger</Popover.Trigger>
              <Popover.Content aria-label="Delayed nested popover">
                <button>Nested action</button>
              </Popover.Content>
            </Popover>
          </Dialog.Content>
        </Dialog>
      )
    }

    render(<ClosedFirstDialog />)

    await userEvent.click(screen.getByRole("button", { name: "Open delayed dialog" }))

    const dialog = screen.getByRole("dialog", { name: "Delayed dialog" })
    const popoverTrigger = screen.getByRole("button", { name: "Nested popover trigger" })
    const popoverId = popoverTrigger.getAttribute("aria-controls")
    if (!popoverId) throw new Error("Expected nested popover trigger to control mounted content")

    await waitFor(() => {
      const popover = document.getElementById(popoverId)
      expect(popover).not.toBeNull()
      expect(dialog.contains(popover)).toBe(true)
      expect(popover?.parentElement).not.toBe(document.body)
    })
  })

  it("trigger has aria-expanded reflecting open state", async () => {
    renderDialog()
    const trigger = screen.getByRole("button", { name: "Open" })
    expect(trigger).toHaveAttribute("aria-expanded", "false")
    await userEvent.click(trigger)
    expect(trigger).toHaveAttribute("aria-expanded", "true")
  })

  it("trigger aria-controls references the dialog content", async () => {
    renderDialog()
    const trigger = screen.getByRole("button", { name: "Open" })
    await userEvent.click(trigger)
    const dialog = screen.getByRole("dialog")
    expect(trigger).toHaveAttribute("aria-controls", dialog.id)
  })

  it("sets aria-labelledby pointing to the title", () => {
    renderDialog({ defaultOpen: true })
    const dialog = screen.getByRole("dialog", { name: "Test Title" })
    const title = screen.getByRole("heading", { name: "Test Title" })
    expect(dialog).toHaveAttribute("aria-labelledby", title.id)
  })

  it("exposes modal dialog semantics", () => {
    renderDialog({ defaultOpen: true })
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true")
  })

  it("warns and applies a fallback name when content has no Dialog.Title or explicit aria name", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

    render(
      <Dialog defaultOpen>
        <Dialog.Content>
          <Dialog.Body>Body content</Dialog.Body>
        </Dialog.Content>
      </Dialog>
    )

    const dialog = screen.getByRole("dialog", { name: "Dialog" })
    expect(dialog).not.toHaveAttribute("aria-labelledby")
    expect(dialog).toHaveAttribute("aria-label", "Dialog")
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Modal dialog is missing an accessible name"))

    warn.mockRestore()
  })

  it("does not warn when Dialog.Title is provided", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

    render(
      <Dialog defaultOpen>
        <Dialog.Content>
          <Dialog.Title>Labeled dialog</Dialog.Title>
          <Dialog.Body>Body content</Dialog.Body>
        </Dialog.Content>
      </Dialog>
    )

    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it("does not warn when aria-label is provided without a title", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

    render(
      <Dialog defaultOpen>
        <Dialog.Content aria-label="Named dialog">
          <Dialog.Body>Body content</Dialog.Body>
        </Dialog.Content>
      </Dialog>
    )

    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it("accepts a Dialog.Title nested inside a pass-through wrapper", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

    function PassThroughWrapper({ children }: { children: ReactNode }) {
      return <div>{children}</div>
    }

    render(
      <Dialog defaultOpen>
        <Dialog.Content>
          <PassThroughWrapper>
            <Dialog.Title>Wrapped title</Dialog.Title>
          </PassThroughWrapper>
          <Dialog.Body>Body content</Dialog.Body>
        </Dialog.Content>
      </Dialog>
    )

    expect(screen.getByRole("dialog", { name: "Wrapped title" })).toBeInTheDocument()
    expect(warn).not.toHaveBeenCalled()
  })

  it("uses an explicit aria-label without pointing to a missing title", () => {
    render(
      <Dialog defaultOpen>
        <Dialog.Content aria-label="Named without title">
          <Dialog.Body>Body content</Dialog.Body>
        </Dialog.Content>
      </Dialog>
    )

    const dialog = screen.getByRole("dialog", { name: "Named without title" })
    expect(dialog).not.toHaveAttribute("aria-labelledby")
  })

  it("uses an explicit aria-labelledby without a Dialog.Title", () => {
    render(
      <>
        <h2 id="external-dialog-name">External dialog name</h2>
        <Dialog defaultOpen>
          <Dialog.Content aria-labelledby="external-dialog-name">
            <Dialog.Body>Body content</Dialog.Body>
          </Dialog.Content>
        </Dialog>
      </>
    )

    const dialog = screen.getByRole("dialog", { name: "External dialog name" })
    expect(dialog).toHaveAttribute("aria-labelledby", "external-dialog-name")
  })

  it("sets aria-describedby when description is present", () => {
    renderDialog({ defaultOpen: true })
    const dialog = screen.getByRole("dialog")
    const description = screen.getByText("Test description")
    expect(dialog).toHaveAttribute("aria-describedby", description.id)
  })

  it("omits aria-describedby when no description is rendered", () => {
    render(
      <Dialog defaultOpen>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>No Description</Dialog.Title>
          </Dialog.Header>
        </Dialog.Content>
      </Dialog>
    )
    const dialog = screen.getByRole("dialog")
    expect(dialog).not.toHaveAttribute("aria-describedby")
  })

  it("emits aria-labelledby (not the aria-label fallback) on the SSR string for defaultOpen with a Title", () => {
    const html = renderToString(
      <Dialog defaultOpen>
        <Dialog.Content>
          <Dialog.Title>SSR title</Dialog.Title>
        </Dialog.Content>
      </Dialog>
    )

    expect(html).toContain("aria-labelledby=")
    expect(html).toContain("SSR title")
    expect(html).not.toContain('aria-label="Dialog"')
  })

  it("emits aria-describedby on the SSR string for defaultOpen with a Description", () => {
    const html = renderToString(
      <Dialog defaultOpen>
        <Dialog.Content>
          <Dialog.Title>SSR title</Dialog.Title>
          <Dialog.Description>SSR description</Dialog.Description>
        </Dialog.Content>
      </Dialog>
    )

    expect(html).toContain("aria-describedby=")
    expect(html).toContain("SSR description")
  })

  it("emits the same accessible-name shape on SSR and on client render (no post-mount flip)", () => {
    const tree = (
      <Dialog defaultOpen>
        <Dialog.Content>
          <Dialog.Title>Stable title</Dialog.Title>
          <Dialog.Description>Stable description</Dialog.Description>
        </Dialog.Content>
      </Dialog>
    )

    const ssrHtml = renderToString(tree)
    expect(ssrHtml).toContain("aria-labelledby=")
    expect(ssrHtml).toContain("aria-describedby=")
    expect(ssrHtml).not.toContain('aria-label="Dialog"')

    render(tree)
    const dialog = screen.getByRole("dialog", { name: "Stable title" })
    const clientLabelledBy = dialog.getAttribute("aria-labelledby")
    const clientDescribedBy = dialog.getAttribute("aria-describedby")
    expect(clientLabelledBy).toBeTruthy()
    expect(clientDescribedBy).toBeTruthy()
    expect(dialog).not.toHaveAttribute("aria-label")

    const title = screen.getByRole("heading", { name: "Stable title" })
    const description = screen.getByText("Stable description")
    expect(clientLabelledBy).toBe(title.id)
    expect(clientDescribedBy).toBe(description.id)
  })

  it("has no a11y violations when open", async () => {
    const { container } = renderDialog({ defaultOpen: true })
    expect(await axe(container)).toHaveNoViolations()
  })

  it("has no a11y violations when closed", async () => {
    const { container } = renderDialog()
    expect(await axe(container)).toHaveNoViolations()
  })

  it("uses an interactive child as the trigger without nesting controls", async () => {
    const { container } = render(
      <Dialog>
        <Dialog.Trigger>
          <button type="button">Open child</button>
        </Dialog.Trigger>
        <Dialog.Content>
          <Dialog.Title>Nested trigger target</Dialog.Title>
          <Dialog.Close />
        </Dialog.Content>
      </Dialog>
    )

    const trigger = screen.getByRole("button", { name: "Open child" })
    // querySelector retained: asserting the ABSENCE of a nested-button structure is the contract (HTML nesting rule); negative role queries cannot prove a structural rule violation does not exist
    expect(container.querySelector("button button")).toBeNull()
    expect(await axe(container)).toHaveNoViolations()

    await userEvent.click(trigger)
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(trigger).toHaveAttribute("aria-expanded", "true")
  })

  it("stacks multiple dialogs correctly", async () => {
    render(
      <>
        <Dialog defaultOpen>
          <Dialog.Trigger>Dialog 1</Dialog.Trigger>
          <Dialog.Content>
            <Dialog.Title>Dialog 1</Dialog.Title>
            <Dialog.Close />
          </Dialog.Content>
        </Dialog>
        <Dialog defaultOpen>
          <Dialog.Trigger>Dialog 2</Dialog.Trigger>
          <Dialog.Content>
            <Dialog.Title>Dialog 2</Dialog.Title>
            <Dialog.Close />
          </Dialog.Content>
        </Dialog>
      </>
    )
    const dialogs = screen.getAllByRole("dialog")
    expect(dialogs).toHaveLength(2)
    expect(screen.getByRole("dialog", { name: "Dialog 1" })).toHaveAttribute("data-state", "open")
    expect(dialogs[1]).toHaveAttribute("data-state", "open")
  })

  it("closes only the top dialog when closing nested dialogs", async () => {
    const onOpenChange1 = vi.fn()
    const onOpenChange2 = vi.fn()
    render(
      <>
        <Dialog onOpenChange={onOpenChange1} defaultOpen>
          <Dialog.Trigger>Dialog 1</Dialog.Trigger>
          <Dialog.Content>
            <Dialog.Title>Dialog 1</Dialog.Title>
            <Dialog.Close />
          </Dialog.Content>
        </Dialog>
        <Dialog onOpenChange={onOpenChange2} defaultOpen>
          <Dialog.Trigger>Dialog 2</Dialog.Trigger>
          <Dialog.Content>
            <Dialog.Title>Dialog 2</Dialog.Title>
            <Dialog.Close />
          </Dialog.Content>
        </Dialog>
      </>
    )
    const firstDialog = screen.getByRole("dialog", { name: "Dialog 1" })
    const secondDialog = screen.getByRole("dialog", { name: "Dialog 2" })
    const closeButtons = screen.getAllByRole("button", { name: "Close dialog" })
    const lastClose = closeButtons[closeButtons.length - 1]
    if (!lastClose) throw new Error("expected close button")
    await userEvent.click(lastClose)

    expect(onOpenChange2).toHaveBeenCalledWith(false)
    expect(onOpenChange1).not.toHaveBeenCalled()
    await waitFor(() => expect(secondDialog).toHaveAttribute("data-state", "closed"))
    expect(firstDialog).toHaveAttribute("data-state", "open")
    expect(document.body).toContainElement(secondDialog)

    // fireEvent retained: animationend has no user-event equivalent
    fireEvent.animationEnd(secondDialog)

    await waitFor(() => expect(document.body).not.toContainElement(secondDialog))
    expect(document.body).toContainElement(firstDialog)
  })

  describe("DialogFooter with keyboard hints", () => {
    const hints = [
      { key: "Esc", label: "Cancel" },
      { key: "↑/↓", label: "Navigate" },
      { key: "Enter", label: "Confirm" },
    ]

    function renderWithHints() {
      return render(
        <Dialog defaultOpen>
          <Dialog.Content>
            <Dialog.Title>Footer with hints</Dialog.Title>
            <Dialog.Footer hints={hints}>
              <Dialog.Close>Cancel</Dialog.Close>
              <Dialog.Action>Confirm</Dialog.Action>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog>
      )
    }

    it("renders hints inside the footer subtree (not absolutely positioned)", () => {
      renderWithHints()
      const dialog = screen.getByRole("dialog", { name: "Footer with hints" })
      const navigateHint = within(dialog).getByText("Navigate")
      const footer = navigateHint.closest('[class*="border-x"]')
      expect(footer).not.toBeNull()
      expect(footer).toContainElement(navigateHint)
      expect(footer?.className).not.toContain("absolute")
    })

    it("renders all hint glyphs as Kbd elements at the default size", () => {
      renderWithHints()
      const dialog = screen.getByRole("dialog", { name: "Footer with hints" })
      for (const hint of hints) {
        const kbd = within(dialog).getByText(hint.key)
        expect(kbd.tagName).toBe("KBD")
        expect(kbd.className).toContain("text-xs")
      }
    })

    it("places hints and actions in a single flex row with items-center", () => {
      renderWithHints()
      const dialog = screen.getByRole("dialog", { name: "Footer with hints" })
      const navigateHint = within(dialog).getByText("Navigate")
      const footer = navigateHint.closest('[class*="border-x"]')
      expect(footer?.className).toContain("items-center")
      expect(footer?.className).not.toContain("items-end")
      expect(footer?.className).toContain("justify-between")
    })

    it("keeps Tab order across action buttons; hint glyphs are not focusable", async () => {
      renderWithHints()
      const cancel = screen.getByRole("button", { name: "Cancel" })
      const confirm = screen.getByRole("button", { name: "Confirm" })

      cancel.focus()
      expect(cancel).toHaveFocus()
      await userEvent.tab()
      expect(confirm).toHaveFocus()

      for (const hint of hints) {
        const kbd = screen.getByText(hint.key)
        expect(kbd.tabIndex).toBe(-1)
        expect(kbd.getAttribute("aria-hidden")).toBe("true")
      }
    })

    it("uses justify-end when no hints are provided", () => {
      render(
        <Dialog defaultOpen>
          <Dialog.Content>
            <Dialog.Title>No hints</Dialog.Title>
            <Dialog.Footer>
              <Dialog.Action>OK</Dialog.Action>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog>
      )
      const dialog = screen.getByRole("dialog", { name: "No hints" })
      const action = within(dialog).getByRole("button", { name: "OK" })
      const footer = action.closest('[class*="border-x"]')
      expect(footer?.className).toContain("justify-end")
      expect(footer?.className).not.toContain("justify-between")
    })

    it("has no a11y violations when rendering hints", async () => {
      const { container } = renderWithHints()
      expect(await axe(container)).toHaveNoViolations()
    })
  })

  it("composes consumer dialog events without replacing backdrop or presence behavior", () => {
    const onOpenChange = vi.fn()
    const onClick = vi.fn((event) => event.preventDefault())
    const onCancel = vi.fn()

    render(
      <Dialog defaultOpen onOpenChange={onOpenChange}>
        <Dialog.Trigger>Open Dialog</Dialog.Trigger>
        <Dialog.Content onClick={onClick} onCancel={onCancel}>
          <Dialog.Title>Composed dialog</Dialog.Title>
        </Dialog.Content>
      </Dialog>
    )

    const dialog = screen.getByRole("dialog", { name: "Composed dialog" })
    mockDialogBounds(dialog)

    // fireEvent retained: backdrop click needs explicit coordinates outside dialog bounds
    fireEvent.click(dialog, { clientX: 80, clientY: 120 })
    // fireEvent retained: native <dialog> cancel event has no user-event equivalent
    fireEvent(dialog, new Event("cancel", { bubbles: false }))

    expect(onClick).toHaveBeenCalled()
    expect(onCancel).toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})

describe("Dialog fallback (no showModal)", () => {
  let restoreShowModal: (() => void) | null = null

  beforeEach(() => {
    // iOS Safari < 15.4 lacks HTMLDialogElement.prototype.showModal. Simulate
    // by deleting the property the test-setup polyfill installs; restore in
    // afterEach so other suites keep the native path.
    const descriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal")
    Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal")
    restoreShowModal = () => {
      if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, "showModal", descriptor)
    }
  })

  afterEach(() => {
    restoreShowModal?.()
    restoreShowModal = null
  })

  it("renders as div with role=dialog when showModal is unavailable", () => {
    render(
      <Dialog defaultOpen>
        <Dialog.Content>
          <Dialog.Title>Fallback dialog</Dialog.Title>
          <Dialog.Body>Body content</Dialog.Body>
          <Dialog.Close>Close</Dialog.Close>
        </Dialog.Content>
      </Dialog>
    )

    const dialog = screen.getByRole("dialog", { name: "Fallback dialog" })
    expect(dialog.tagName).toBe("DIV")
    expect(dialog).toHaveAttribute("aria-modal", "true")
    expect(dialog).toHaveAttribute("data-state", "open")
  })

  it("closes on Escape in fallback path", async () => {
    const onOpenChange = vi.fn()
    render(
      <Dialog defaultOpen onOpenChange={onOpenChange}>
        <Dialog.Content>
          <Dialog.Title>Fallback dialog</Dialog.Title>
          <Dialog.Close>Close</Dialog.Close>
        </Dialog.Content>
      </Dialog>
    )

    const dialog = screen.getByRole("dialog", { name: "Fallback dialog" })
    dialog.focus()
    await userEvent.keyboard("{Escape}")

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("closes on outside tap in fallback path", () => {
    const onOpenChange = vi.fn()
    render(
      <div>
        <button>Outside</button>
        <Dialog defaultOpen onOpenChange={onOpenChange}>
          <Dialog.Content>
            <Dialog.Title>Fallback dialog</Dialog.Title>
            <Dialog.Close>Close</Dialog.Close>
          </Dialog.Content>
        </Dialog>
      </div>
    )

    expect(screen.getByRole("dialog", { name: "Fallback dialog" })).toBeInTheDocument()
    // fireEvent retained: document-level pointerdown listener attaches in capture phase
    fireEvent.pointerDown(screen.getByRole("button", { name: "Outside" }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("marks background body siblings as inert while fallback dialog is open", () => {
    render(
      <>
        <div data-testid="page-shell">Page shell</div>
        <Dialog defaultOpen>
          <Dialog.Content>
            <Dialog.Title>Fallback dialog</Dialog.Title>
            <Dialog.Close>Close</Dialog.Close>
          </Dialog.Content>
        </Dialog>
      </>
    )

    expect(screen.getByRole("dialog", { name: "Fallback dialog" })).toBeInTheDocument()
    // page-shell is rendered as a sibling of the dialog under body in jsdom
    const pageShell = screen.getByTestId("page-shell")
    const inertedAncestor = pageShell.closest("[inert]")
    expect(inertedAncestor).not.toBeNull()
  })
})

describe("Dialog body scroll lock (CSS-only)", () => {
  // Source dialog.css lives at registry/ui/shared/dialog.css; this test reads
  // the real file and asserts the body-lock rule both exists in source and
  // takes effect on a live document, so any change to the selector or the
  // declaration block is caught here. jsdom's CSSOM does not apply rules
  // nested inside @layer blocks, so the rule is extracted and injected at the
  // top level for the runtime assertions.
  const DIALOG_CSS_PATH = resolve(fileURLToPath(import.meta.url), "../../shared/dialog.css")
  const BODY_LOCK_RULE_RE = /body:has\(dialog\[open\]\)\s*\{[^}]*\}/
  let styleElement: HTMLStyleElement | null = null

  beforeAll(() => {
    const sourceCss = readFileSync(DIALOG_CSS_PATH, "utf8")
    const bodyLockRule = sourceCss.match(BODY_LOCK_RULE_RE)?.[0]
    if (!bodyLockRule) {
      throw new Error("dialog.css must declare a body:has(dialog[open]) rule for the scroll lock contract")
    }
    if (!/overflow\s*:\s*hidden/.test(bodyLockRule)) {
      throw new Error("dialog.css body:has(dialog[open]) rule must set overflow: hidden")
    }
    styleElement = document.createElement("style")
    styleElement.dataset.testSource = "dialog.css#body-lock"
    styleElement.textContent = bodyLockRule
    document.head.appendChild(styleElement)
  })

  afterAll(() => {
    styleElement?.remove()
    styleElement = null
  })

  it("locks body overflow while a Dialog is open and releases it on close", async () => {
    const baselineOverflow = getComputedStyle(document.body).overflow
    expect(baselineOverflow).not.toBe("hidden")

    render(
      <Dialog defaultOpen>
        <Dialog.Content>
          <Dialog.Title>Scroll lock dialog</Dialog.Title>
          <Dialog.Close />
        </Dialog.Content>
      </Dialog>
    )

    const dialog = screen.getByRole("dialog", { name: "Scroll lock dialog" })
    expect(getComputedStyle(document.body).overflow).toBe("hidden")

    await userEvent.click(screen.getByRole("button", { name: "Close dialog" }))
    await waitFor(() => expect(dialog).toHaveAttribute("data-state", "closed"))
    // fireEvent retained: animationend has no user-event equivalent; presence transitions complete on this event
    fireEvent.animationEnd(dialog)
    await waitFor(() => expect(document.body).not.toContainElement(dialog))

    expect(getComputedStyle(document.body).overflow).toBe(baselineOverflow)
  })

  it("keeps body locked while any of multiple open dialogs remains open", async () => {
    render(
      <>
        <Dialog defaultOpen>
          <Dialog.Content>
            <Dialog.Title>Outer dialog</Dialog.Title>
            <Dialog.Close>Close outer</Dialog.Close>
          </Dialog.Content>
        </Dialog>
        <Dialog defaultOpen>
          <Dialog.Content>
            <Dialog.Title>Inner dialog</Dialog.Title>
            <Dialog.Close>Close inner</Dialog.Close>
          </Dialog.Content>
        </Dialog>
      </>
    )

    expect(getComputedStyle(document.body).overflow).toBe("hidden")

    const innerDialog = screen.getByRole("dialog", { name: "Inner dialog" })
    await userEvent.click(screen.getByRole("button", { name: "Close inner" }))
    await waitFor(() => expect(innerDialog).toHaveAttribute("data-state", "closed"))
    // fireEvent retained: animationend has no user-event equivalent
    fireEvent.animationEnd(innerDialog)
    await waitFor(() => expect(document.body).not.toContainElement(innerDialog))

    expect(getComputedStyle(document.body).overflow).toBe("hidden")

    const outerDialog = screen.getByRole("dialog", { name: "Outer dialog" })
    await userEvent.click(screen.getByRole("button", { name: "Close outer" }))
    await waitFor(() => expect(outerDialog).toHaveAttribute("data-state", "closed"))
    // fireEvent retained: animationend has no user-event equivalent
    fireEvent.animationEnd(outerDialog)
    await waitFor(() => expect(document.body).not.toContainElement(outerDialog))

    expect(getComputedStyle(document.body).overflow).not.toBe("hidden")
  })
})

describe("Dialog prefers-reduced-motion (CSS-only)", () => {
  // dialog.css declares a @media (prefers-reduced-motion: reduce) block that
  // sets `animation: none !important` for both the <dialog> element and
  // ::backdrop. jsdom does not evaluate @media in stylesheets, so the rule's
  // declaration is extracted and injected unconditionally at the top level
  // to simulate matchMedia returning true; getComputedStyle then reports
  // the suppressed animation.
  const DIALOG_CSS_PATH = resolve(fileURLToPath(import.meta.url), "../../shared/dialog.css")
  const REDUCED_MOTION_RULE_RE = /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{\s*dialog,?\s*\n?\s*dialog::backdrop\s*\{[^}]*\}\s*\}/
  let styleElement: HTMLStyleElement | null = null

  beforeAll(() => {
    const sourceCss = readFileSync(DIALOG_CSS_PATH, "utf8")
    const ruleBlock = sourceCss.match(REDUCED_MOTION_RULE_RE)?.[0]
    if (!ruleBlock) {
      throw new Error("dialog.css must declare a @media (prefers-reduced-motion: reduce) rule for dialog and dialog::backdrop")
    }
    if (!/animation:\s*none\s*!important/.test(ruleBlock)) {
      throw new Error("dialog.css reduced-motion rule must set animation: none !important (not animation-duration: 0.01s)")
    }
    if (/animation-duration:\s*0\.01s/.test(ruleBlock)) {
      throw new Error("dialog.css reduced-motion rule must no longer use animation-duration: 0.01s !important")
    }
    const declaration = ruleBlock.match(/\{[^{]*\{([^}]*)\}/)?.[1]
    if (!declaration) throw new Error("dialog.css reduced-motion rule body could not be extracted")
    styleElement = document.createElement("style")
    styleElement.dataset.testSource = "dialog.css#reduced-motion"
    styleElement.textContent = `dialog { ${declaration} }`
    document.head.appendChild(styleElement)
  })

  afterAll(() => {
    styleElement?.remove()
    styleElement = null
  })

  it("suppresses dialog open animation under prefers-reduced-motion", () => {
    render(
      <Dialog defaultOpen>
        <Dialog.Content>
          <Dialog.Title>Reduced motion dialog</Dialog.Title>
          <Dialog.Close />
        </Dialog.Content>
      </Dialog>,
    )

    const dialog = screen.getByRole("dialog", { name: "Reduced motion dialog" })
    expect(getComputedStyle(dialog).animation).toBe("none")
  })
})
