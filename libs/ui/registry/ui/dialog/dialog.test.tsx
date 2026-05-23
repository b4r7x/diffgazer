import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { axe } from "../../../testing/utils.js"
import { afterEach, afterAll, beforeAll, beforeEach, describe, it, expect, vi } from "vitest"
import { useRef, useState, type ReactNode, type SyntheticEvent } from "react"
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

  it("trigger advertises aria-haspopup='dialog' to assistive tech", () => {
    renderDialog()
    expect(screen.getByRole("button", { name: "Open" })).toHaveAttribute("aria-haspopup", "dialog")
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

  it("applies a fallback name when content has no Dialog.Title or explicit aria name", () => {
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
  })

  it("accepts a Dialog.Title nested inside a pass-through wrapper", () => {
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

  it("aria-labelledby wins over both aria-label and Dialog.Title", () => {
    render(
      <>
        <h2 id="external-name">External wins</h2>
        <Dialog defaultOpen>
          <Dialog.Content aria-labelledby="external-name" aria-label="ignored">
            <Dialog.Title>Also ignored</Dialog.Title>
            <Dialog.Body>Body content</Dialog.Body>
          </Dialog.Content>
        </Dialog>
      </>
    )

    const dialog = screen.getByRole("dialog", { name: "External wins" })
    expect(dialog).toHaveAttribute("aria-labelledby", "external-name")
    expect(dialog).not.toHaveAttribute("aria-label")
  })

  it("aria-label wins over Dialog.Title when no aria-labelledby is provided", () => {
    render(
      <Dialog defaultOpen>
        <Dialog.Content aria-label="Label wins">
          <Dialog.Title>Ignored title</Dialog.Title>
          <Dialog.Body>Body content</Dialog.Body>
        </Dialog.Content>
      </Dialog>
    )

    const dialog = screen.getByRole("dialog", { name: "Label wins" })
    expect(dialog).toHaveAttribute("aria-label", "Label wins")
    expect(dialog).not.toHaveAttribute("aria-labelledby")
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

    it("renders hints inside the footer subtree", () => {
      renderWithHints()
      const dialog = screen.getByRole("dialog", { name: "Footer with hints" })
      const navigateHint = within(dialog).getByText("Navigate")
      const footer = navigateHint.closest('[data-slot="dialog-footer"]')
      expect(footer).not.toBeNull()
      expect(footer).toContainElement(navigateHint)
    })

    it("renders all hint glyphs as Kbd elements", () => {
      renderWithHints()
      const dialog = screen.getByRole("dialog", { name: "Footer with hints" })
      for (const hint of hints) {
        const kbd = within(dialog).getByText(hint.key)
        expect(kbd.tagName).toBe("KBD")
      }
    })

    it("orders hints before actions inside the footer", () => {
      renderWithHints()
      const dialog = screen.getByRole("dialog", { name: "Footer with hints" })
      const navigateHint = within(dialog).getByText("Navigate")
      const footer = navigateHint.closest('[data-slot="dialog-footer"]')
      if (!footer) throw new Error("Expected dialog footer to be present")
      const confirmAction = within(dialog).getByRole("button", { name: "Confirm" })
      const FOLLOWING = Node.DOCUMENT_POSITION_FOLLOWING
      expect(navigateHint.compareDocumentPosition(confirmAction) & FOLLOWING).toBe(FOLLOWING)
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

    it("renders no hint glyphs when no hints are provided", () => {
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
      const footer = action.closest('[data-slot="dialog-footer"]')
      if (!footer) throw new Error("Expected dialog footer to be present")
      expect(within(dialog).getByRole("button", { name: "OK" })).toBeInTheDocument()
      expect(footer.querySelector("kbd")).toBeNull()
    })

    it("has no a11y violations when rendering hints", async () => {
      const { container } = renderWithHints()
      expect(await axe(container)).toHaveNoViolations()
    })
  })

  describe("DialogContent frame and corners", () => {
    it("defaults to frame='border' corners='none' and does not render a .dlg-corners host", () => {
      render(
        <Dialog defaultOpen>
          <Dialog.Content>
            <Dialog.Title>Default frame</Dialog.Title>
          </Dialog.Content>
        </Dialog>
      )
      const dialog = screen.getByRole("dialog", { name: "Default frame" })
      expect(dialog).toHaveAttribute("data-slot", "dialog-content")
      expect(dialog).toHaveAttribute("data-frame", "border")
      expect(dialog).toHaveAttribute("data-corners", "none")
      expect(dialog.querySelector(".dlg-corners")).toBeNull()
    })

    const cornersValues = ["subtle", "standard", "bold", "outset"] as const

    for (const corners of cornersValues) {
      it(`corners="${corners}" sets data-corners and renders the .dlg-corners host`, () => {
        render(
          <Dialog defaultOpen>
            <Dialog.Content corners={corners}>
              <Dialog.Title>Corners {corners}</Dialog.Title>
            </Dialog.Content>
          </Dialog>
        )
        const dialog = screen.getByRole("dialog", { name: `Corners ${corners}` })
        expect(dialog).toHaveAttribute("data-corners", corners)
        const host = dialog.querySelector(".dlg-corners")
        expect(host).not.toBeNull()
        expect(host).toHaveAttribute("aria-hidden", "true")
      })
    }

    it("corners='none' does not render the .dlg-corners host", () => {
      render(
        <Dialog defaultOpen>
          <Dialog.Content corners="none">
            <Dialog.Title>No corners</Dialog.Title>
          </Dialog.Content>
        </Dialog>
      )
      const dialog = screen.getByRole("dialog", { name: "No corners" })
      expect(dialog.querySelector(".dlg-corners")).toBeNull()
    })

    it.each([
      { frame: "border" as const, corners: "none" as const, label: "default frame" },
      { frame: "border" as const, corners: "standard" as const, label: "bracketed frame" },
      { frame: "none" as const, corners: "standard" as const, label: "viewfinder standard" },
      { frame: "none" as const, corners: "subtle" as const, label: "viewfinder subtle" },
      { frame: "none" as const, corners: "bold" as const, label: "viewfinder bold" },
      { frame: "none" as const, corners: "outset" as const, label: "viewfinder outset" },
    ])("$label combination renders data-frame=$frame and data-corners=$corners", ({ frame, corners, label }) => {
      render(
        <Dialog defaultOpen>
          <Dialog.Content frame={frame} corners={corners}>
            <Dialog.Title>{label}</Dialog.Title>
          </Dialog.Content>
        </Dialog>
      )
      const dialog = screen.getByRole("dialog", { name: label })
      expect(dialog).toHaveAttribute("data-frame", frame)
      expect(dialog).toHaveAttribute("data-corners", corners)
    })
  })

  describe("DialogTitle data-slot", () => {
    it("exposes data-slot=\"dialog-title\" on the heading element", () => {
      render(
        <Dialog defaultOpen>
          <Dialog.Content>
            <Dialog.Title>Slotted title</Dialog.Title>
          </Dialog.Content>
        </Dialog>
      )
      const heading = screen.getByRole("heading", { name: "Slotted title" })
      expect(heading).toHaveAttribute("data-slot", "dialog-title")
    })
  })

  describe("DialogHeader marker and DialogTitle meta", () => {
    it("renders an aria-hidden bar marker inside the header by default", () => {
      render(
        <Dialog defaultOpen>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Bar title</Dialog.Title>
            </Dialog.Header>
          </Dialog.Content>
        </Dialog>
      )
      const dialog = screen.getByRole("dialog", { name: "Bar title" })
      const header = dialog.querySelector('[data-slot="dialog-header"]')
      if (!header) throw new Error("Expected dialog header")
      const bar = header.querySelector(':scope > [aria-hidden="true"]')
      expect(bar).not.toBeNull()
    })

    it("omits the bar when marker is 'none'", () => {
      render(
        <Dialog defaultOpen>
          <Dialog.Content>
            <Dialog.Header marker="none">
              <Dialog.Title>Plain title</Dialog.Title>
            </Dialog.Header>
          </Dialog.Content>
        </Dialog>
      )
      const dialog = screen.getByRole("dialog", { name: "Plain title" })
      const header = dialog.querySelector('[data-slot="dialog-header"]')
      if (!header) throw new Error("Expected dialog header")
      expect(header.querySelector(':scope > [aria-hidden="true"]')).toBeNull()
    })

    it("renders Title and Description inside the header subtree", () => {
      render(
        <Dialog defaultOpen>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Column title</Dialog.Title>
              <Dialog.Description>Column description</Dialog.Description>
            </Dialog.Header>
          </Dialog.Content>
        </Dialog>
      )
      const heading = screen.getByRole("heading", { name: "Column title" })
      const header = heading.closest('[data-slot="dialog-header"]')
      if (!header) throw new Error("Expected dialog header")
      expect(within(header as HTMLElement).getByRole("heading", { name: "Column title" })).toBe(heading)
      expect(within(header as HTMLElement).getByText("Column description")).toBeInTheDocument()
    })

    it("renders the meta tag with aria-hidden so it stays out of the accessible name", () => {
      render(
        <Dialog defaultOpen>
          <Dialog.Content>
            <Dialog.Title meta="CONFIRM">Apply patch</Dialog.Title>
          </Dialog.Content>
        </Dialog>
      )
      const dialog = screen.getByRole("dialog", { name: "Apply patch" })
      const meta = within(dialog).getByText("CONFIRM")
      expect(meta).toHaveAttribute("aria-hidden", "true")
    })

    it("omits the meta tag when not provided", () => {
      render(
        <Dialog defaultOpen>
          <Dialog.Content>
            <Dialog.Title>No meta</Dialog.Title>
          </Dialog.Content>
        </Dialog>
      )
      const dialog = screen.getByRole("dialog", { name: "No meta" })
      expect(within(dialog).queryByText("CONFIRM")).toBeNull()
    })

    it("marker='none' renders children as direct descendants of the header (no inner wrapper)", () => {
      render(
        <Dialog defaultOpen>
          <Dialog.Content>
            <Dialog.Header marker="none">
              <Dialog.Title>Flat header</Dialog.Title>
            </Dialog.Header>
          </Dialog.Content>
        </Dialog>
      )
      const header = screen.getByRole("dialog", { name: "Flat header" }).querySelector('[data-slot="dialog-header"]') as HTMLElement | null
      if (!header) throw new Error("Expected dialog header")
      expect(header.firstElementChild).toHaveAttribute("data-slot", "dialog-title")
    })

    it("marker='none' preserves automatic accessible-name resolution via Dialog.Title", () => {
      render(
        <Dialog defaultOpen>
          <Dialog.Content>
            <Dialog.Header marker="none">
              <Dialog.Title>Auto labelled</Dialog.Title>
            </Dialog.Header>
          </Dialog.Content>
        </Dialog>
      )
      const dialog = screen.getByRole("dialog", { name: "Auto labelled" })
      expect(dialog).toHaveAttribute("aria-labelledby")
      expect(dialog).not.toHaveAttribute("aria-label")
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

  it("keeps the dialog open when consumer onCancel calls preventDefault", () => {
    const onOpenChange = vi.fn()
    const onCancel = vi.fn((event: SyntheticEvent<HTMLDialogElement>) => event.preventDefault())

    render(
      <Dialog defaultOpen onOpenChange={onOpenChange}>
        <Dialog.Content onCancel={onCancel}>
          <Dialog.Title>Cancel prevented</Dialog.Title>
        </Dialog.Content>
      </Dialog>
    )

    const dialog = screen.getByRole("dialog", { name: "Cancel prevented" })
    // fireEvent retained: native <dialog> cancel event has no user-event equivalent
    fireEvent(dialog, new Event("cancel", { bubbles: false }))

    expect(onCancel).toHaveBeenCalled()
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(dialog).toHaveAttribute("data-state", "open")
  })

  it("fires onEscapeKeyDown when the user dismisses with Escape", () => {
    const onEscapeKeyDown = vi.fn()
    const onOpenChange = vi.fn()

    render(
      <Dialog defaultOpen onOpenChange={onOpenChange}>
        <Dialog.Content onEscapeKeyDown={onEscapeKeyDown}>
          <Dialog.Title>Escape intercepted</Dialog.Title>
        </Dialog.Content>
      </Dialog>
    )

    const dialog = screen.getByRole("dialog", { name: "Escape intercepted" })
    // fireEvent retained: native <dialog> cancel event has no user-event equivalent
    fireEvent(dialog, new Event("cancel", { bubbles: false }))

    expect(onEscapeKeyDown).toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("keeps the dialog open when onEscapeKeyDown calls preventDefault", () => {
    const onOpenChange = vi.fn()
    const onEscapeKeyDown = vi.fn((event: SyntheticEvent<HTMLDialogElement>) => event.preventDefault())

    render(
      <Dialog defaultOpen onOpenChange={onOpenChange}>
        <Dialog.Content onEscapeKeyDown={onEscapeKeyDown}>
          <Dialog.Title>Escape prevented</Dialog.Title>
        </Dialog.Content>
      </Dialog>
    )

    const dialog = screen.getByRole("dialog", { name: "Escape prevented" })
    // fireEvent retained: native <dialog> cancel event has no user-event equivalent
    fireEvent(dialog, new Event("cancel", { bubbles: false }))

    expect(onEscapeKeyDown).toHaveBeenCalled()
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(dialog).toHaveAttribute("data-state", "open")
  })

  it("exposes role=\"alertdialog\" when DialogContent role is alertdialog", () => {
    render(
      <Dialog defaultOpen>
        <Dialog.Content role="alertdialog">
          <Dialog.Title>Destructive confirmation</Dialog.Title>
        </Dialog.Content>
      </Dialog>
    )

    expect(screen.getByRole("alertdialog", { name: "Destructive confirmation" })).toBeInTheDocument()
  })

  it("renders DialogTitle as the heading level set by the as prop", () => {
    render(
      <Dialog defaultOpen>
        <Dialog.Content>
          <Dialog.Title as="h3">Heading level three</Dialog.Title>
        </Dialog.Content>
      </Dialog>
    )

    const heading = screen.getByRole("heading", { name: "Heading level three", level: 3 })
    expect(heading.tagName).toBe("H3")
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

describe("DialogContent corner CSS tokens (CSS-only)", () => {
  // dialog.css declares corner accent rules nested inside @layer components.
  // jsdom's CSSOM does not apply rules inside @layer, so every rule that
  // targets [data-corners] is extracted and injected at the top level.
  // The tests then assert getComputedStyle resolves the expected --dlg-corner-*
  // custom properties per corners value.
  const DIALOG_CSS_PATH = resolve(fileURLToPath(import.meta.url), "../../shared/dialog.css")
  let styleElement: HTMLStyleElement | null = null

  beforeAll(() => {
    const sourceCss = readFileSync(DIALOG_CSS_PATH, "utf8")
    if (!sourceCss.includes('[data-corners]:not([data-corners="none"])')) {
      throw new Error('dialog.css must use [data-corners]:not([data-corners="none"]) as the non-none selector')
    }
    const rules = [...sourceCss.matchAll(/\[data-slot="dialog-content"\][^{]*\{[^}]*\}/g)].map(m => m[0])
    if (rules.length === 0) {
      throw new Error("dialog.css must declare [data-slot=\"dialog-content\"] corner rules")
    }
    styleElement = document.createElement("style")
    styleElement.dataset.testSource = "dialog.css#corners"
    styleElement.textContent = rules.join("\n")
    document.head.appendChild(styleElement)
  })

  afterAll(() => {
    styleElement?.remove()
    styleElement = null
  })

  it("corners='standard' resolves to 18px / 2px / foreground / 0px", () => {
    render(
      <Dialog defaultOpen>
        <Dialog.Content corners="standard">
          <Dialog.Title>Standard corners</Dialog.Title>
        </Dialog.Content>
      </Dialog>,
    )
    const dialog = screen.getByRole("dialog", { name: "Standard corners" })
    const styles = getComputedStyle(dialog)
    expect(styles.getPropertyValue("--dlg-corner-size").trim()).toBe("18px")
    expect(styles.getPropertyValue("--dlg-corner-weight").trim()).toBe("2px")
    expect(styles.getPropertyValue("--dlg-corner-color").trim()).toBe("var(--foreground)")
    expect(styles.getPropertyValue("--dlg-corner-offset").trim()).toBe("0px")
  })

  it("corners='subtle' resolves to 12px / 1.5px / border / 0px", () => {
    render(
      <Dialog defaultOpen>
        <Dialog.Content corners="subtle">
          <Dialog.Title>Subtle corners</Dialog.Title>
        </Dialog.Content>
      </Dialog>,
    )
    const dialog = screen.getByRole("dialog", { name: "Subtle corners" })
    const styles = getComputedStyle(dialog)
    expect(styles.getPropertyValue("--dlg-corner-size").trim()).toBe("12px")
    expect(styles.getPropertyValue("--dlg-corner-weight").trim()).toBe("1.5px")
    expect(styles.getPropertyValue("--dlg-corner-color").trim()).toBe("var(--border)")
    expect(styles.getPropertyValue("--dlg-corner-offset").trim()).toBe("0px")
  })

  it("corners='bold' resolves to 28px / 3px / foreground / 0px", () => {
    render(
      <Dialog defaultOpen>
        <Dialog.Content corners="bold">
          <Dialog.Title>Bold corners</Dialog.Title>
        </Dialog.Content>
      </Dialog>,
    )
    const dialog = screen.getByRole("dialog", { name: "Bold corners" })
    const styles = getComputedStyle(dialog)
    expect(styles.getPropertyValue("--dlg-corner-size").trim()).toBe("28px")
    expect(styles.getPropertyValue("--dlg-corner-weight").trim()).toBe("3px")
    expect(styles.getPropertyValue("--dlg-corner-color").trim()).toBe("var(--foreground)")
    expect(styles.getPropertyValue("--dlg-corner-offset").trim()).toBe("0px")
  })

  it("corners='outset' resolves to 18px / 2px / foreground / -3px offset", () => {
    render(
      <Dialog defaultOpen>
        <Dialog.Content corners="outset">
          <Dialog.Title>Outset corners</Dialog.Title>
        </Dialog.Content>
      </Dialog>,
    )
    const dialog = screen.getByRole("dialog", { name: "Outset corners" })
    const styles = getComputedStyle(dialog)
    expect(styles.getPropertyValue("--dlg-corner-size").trim()).toBe("18px")
    expect(styles.getPropertyValue("--dlg-corner-weight").trim()).toBe("2px")
    expect(styles.getPropertyValue("--dlg-corner-color").trim()).toBe("var(--foreground)")
    expect(styles.getPropertyValue("--dlg-corner-offset").trim()).toBe("-3px")
  })

  it("corners='none' does not set any --dlg-corner-* custom properties", () => {
    render(
      <Dialog defaultOpen>
        <Dialog.Content corners="none">
          <Dialog.Title>No corners</Dialog.Title>
        </Dialog.Content>
      </Dialog>,
    )
    const dialog = screen.getByRole("dialog", { name: "No corners" })
    const styles = getComputedStyle(dialog)
    expect(styles.getPropertyValue("--dlg-corner-size").trim()).toBe("")
    expect(styles.getPropertyValue("--dlg-corner-weight").trim()).toBe("")
    expect(styles.getPropertyValue("--dlg-corner-color").trim()).toBe("")
    expect(styles.getPropertyValue("--dlg-corner-offset").trim()).toBe("")
  })
})

describe("Dialog.CloseIcon", () => {
  it("renders a button with default aria-label=\"Close dialog\" when placed inside Dialog.Content", () => {
    render(
      <Dialog defaultOpen>
        <Dialog.Content>
          <Dialog.Title>With close icon</Dialog.Title>
          <Dialog.CloseIcon />
        </Dialog.Content>
      </Dialog>
    )
    expect(screen.getByRole("button", { name: "Close dialog" })).toBeInTheDocument()
  })

  it("accepts a custom aria-label override", () => {
    render(
      <Dialog defaultOpen>
        <Dialog.Content>
          <Dialog.Title>Localized</Dialog.Title>
          <Dialog.CloseIcon aria-label="Zamknij okno" />
        </Dialog.Content>
      </Dialog>
    )
    expect(screen.getByRole("button", { name: "Zamknij okno" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Close dialog" })).toBeNull()
  })

  it("clicking closes the dialog", async () => {
    render(
      <Dialog defaultOpen>
        <Dialog.Content>
          <Dialog.Title>Click closes</Dialog.Title>
          <Dialog.CloseIcon />
        </Dialog.Content>
      </Dialog>
    )
    const dialog = screen.getByRole("dialog", { name: "Click closes" })
    expect(dialog).toHaveAttribute("data-state", "open")
    await userEvent.click(screen.getByRole("button", { name: "Close dialog" }))
    expect(dialog).toHaveAttribute("data-state", "closed")
  })

  it("is tabbable and receives initial focus when it is the only focusable child", async () => {
    render(
      <Dialog defaultOpen>
        <Dialog.Content>
          <Dialog.Title>Tabbable</Dialog.Title>
          <Dialog.CloseIcon />
        </Dialog.Content>
      </Dialog>
    )
    const closeIcon = screen.getByRole("button", { name: "Close dialog" })
    await waitFor(() => expect(closeIcon).toHaveFocus())
  })

  it("exposes data-slot=\"dialog-close-icon\"", () => {
    render(
      <Dialog defaultOpen>
        <Dialog.Content>
          <Dialog.Title>Slotted</Dialog.Title>
          <Dialog.CloseIcon />
        </Dialog.Content>
      </Dialog>
    )
    const closeIcon = screen.getByRole("button", { name: "Close dialog" })
    expect(closeIcon).toHaveAttribute("data-slot", "dialog-close-icon")
  })

  it("is opt-in: a dialog without Dialog.CloseIcon has no top-right close button", () => {
    render(
      <Dialog defaultOpen>
        <Dialog.Content>
          <Dialog.Title>No close icon</Dialog.Title>
          <Dialog.Body>Body content</Dialog.Body>
        </Dialog.Content>
      </Dialog>
    )
    const dialog = screen.getByRole("dialog", { name: "No close icon" })
    expect(dialog.querySelector('[data-slot="dialog-close-icon"]')).toBeNull()
    expect(screen.queryByRole("button", { name: "Close dialog" })).toBeNull()
  })

  it("consumer onClick can preventDefault to keep the dialog open", async () => {
    render(
      <Dialog defaultOpen>
        <Dialog.Content>
          <Dialog.Title>Prevented</Dialog.Title>
          <Dialog.CloseIcon onClick={(e) => e.preventDefault()} />
        </Dialog.Content>
      </Dialog>
    )
    const dialog = screen.getByRole("dialog", { name: "Prevented" })
    await userEvent.click(screen.getByRole("button", { name: "Close dialog" }))
    expect(dialog).toHaveAttribute("data-state", "open")
  })

  it("has no a11y violations when rendered open", async () => {
    const { container } = render(
      <Dialog defaultOpen>
        <Dialog.Content>
          <Dialog.Title>A11y</Dialog.Title>
          <Dialog.CloseIcon />
        </Dialog.Content>
      </Dialog>
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe("Dialog focus trap", () => {
  it("Tab from the last focusable wraps back to the first", async () => {
    render(
      <Dialog defaultOpen>
        <Dialog.Content>
          <Dialog.Title>Trapped dialog</Dialog.Title>
          <Dialog.Footer>
            <Dialog.Close>Cancel</Dialog.Close>
            <Dialog.Action>Confirm</Dialog.Action>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog>
    )

    const cancel = screen.getByRole("button", { name: "Cancel" })
    const confirm = screen.getByRole("button", { name: "Confirm" })

    confirm.focus()
    expect(confirm).toHaveFocus()

    await userEvent.tab()
    expect(cancel).toHaveFocus()
  })

  it("Shift+Tab from the first focusable wraps to the last", async () => {
    render(
      <Dialog defaultOpen>
        <Dialog.Content>
          <Dialog.Title>Trapped dialog</Dialog.Title>
          <Dialog.Footer>
            <Dialog.Close>Cancel</Dialog.Close>
            <Dialog.Action>Confirm</Dialog.Action>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog>
    )

    const cancel = screen.getByRole("button", { name: "Cancel" })
    const confirm = screen.getByRole("button", { name: "Confirm" })

    cancel.focus()
    expect(cancel).toHaveFocus()

    await userEvent.tab({ shift: true })
    expect(confirm).toHaveFocus()
  })

  it("focuses the initialFocus target on open when provided", async () => {
    function InitialFocusDialog() {
      const confirmRef = useRef<HTMLButtonElement>(null)
      return (
        <Dialog defaultOpen>
          <Dialog.Content initialFocus={confirmRef}>
            <Dialog.Title>Initial focus dialog</Dialog.Title>
            <Dialog.Footer>
              <Dialog.Close>Cancel</Dialog.Close>
              <Dialog.Action ref={confirmRef}>Confirm</Dialog.Action>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog>
      )
    }

    render(<InitialFocusDialog />)

    const confirm = screen.getByRole("button", { name: "Confirm" })
    await waitFor(() => expect(confirm).toHaveFocus())
  })

  it("focuses the first focusable element on open when no initialFocus is provided", async () => {
    render(
      <Dialog defaultOpen>
        <Dialog.Content>
          <Dialog.Title>Default focus dialog</Dialog.Title>
          <Dialog.Footer>
            <Dialog.Close>Cancel</Dialog.Close>
            <Dialog.Action>Confirm</Dialog.Action>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog>
    )

    const cancel = screen.getByRole("button", { name: "Cancel" })
    await waitFor(() => expect(cancel).toHaveFocus())
  })

  it("focuses the first footer action on open and Tab cycles through CloseIcon, wrapping at the boundaries", async () => {
    render(
      <Dialog defaultOpen>
        <Dialog.Content>
          <Dialog.Title>Trap with close icon</Dialog.Title>
          <Dialog.Footer>
            <Dialog.Close>Cancel</Dialog.Close>
            <Dialog.Action>Confirm</Dialog.Action>
          </Dialog.Footer>
          <Dialog.CloseIcon />
        </Dialog.Content>
      </Dialog>
    )

    const cancel = screen.getByRole("button", { name: "Cancel" })
    const confirm = screen.getByRole("button", { name: "Confirm" })
    const closeIcon = screen.getByRole("button", { name: "Close dialog" })

    await waitFor(() => expect(cancel).toHaveFocus())

    await userEvent.tab()
    expect(confirm).toHaveFocus()
    await userEvent.tab()
    expect(closeIcon).toHaveFocus()
    await userEvent.tab()
    expect(cancel).toHaveFocus()

    await userEvent.tab({ shift: true })
    expect(closeIcon).toHaveFocus()
  })
})
