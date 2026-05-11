import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, it, expect, vi } from "vitest"
import { Dialog } from "../dialog/index.js"
import { Popover } from "../popover/index.js"

describe("Nested overlay: Popover inside Dialog", () => {
  it("Escape on open popover closes only the popover, not the dialog", async () => {
    const onDialogChange = vi.fn()
    const onPopoverChange = vi.fn()

    render(
      <Dialog defaultOpen onOpenChange={onDialogChange}>
        <Dialog.Trigger>Open Dialog</Dialog.Trigger>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>Test Dialog</Dialog.Title>
          </Dialog.Header>
          <Popover triggerMode="click" defaultOpen onOpenChange={onPopoverChange}>
            <Popover.Trigger>Open Popover</Popover.Trigger>
            <Popover.Content aria-label="Nested popover">
              <button>Inside Popover</button>
            </Popover.Content>
          </Popover>
        </Dialog.Content>
      </Dialog>
    )

    const dialog = screen.getByRole("dialog", { name: "Test Dialog" })
    const popoverTrigger = screen.getByRole("button", { name: "Open Popover" })
    const popoverId = popoverTrigger.getAttribute("aria-controls")
    if (!popoverId) throw new Error("Expected popover trigger to control mounted content")

    const popover = document.getElementById(popoverId)
    expect(dialog).toHaveAttribute("data-state", "open")
    expect(popoverTrigger).toHaveAttribute("aria-expanded", "true")
    expect(popover).toHaveAttribute("aria-label", "Nested popover")
    expect(popover).toHaveAttribute("data-state", "open")

    await userEvent.keyboard("{Escape}")

    expect(onPopoverChange).toHaveBeenCalledWith(false)
    expect(onDialogChange).not.toHaveBeenCalled()
    expect(dialog).toHaveAttribute("data-state", "open")
    expect(popoverTrigger).toHaveAttribute("aria-expanded", "false")
    expect(popover).toHaveAttribute("data-state", "closed")
  })
})

describe("Nested overlay: Dialog inside Dialog", () => {
  it("restores focus to the parent's last focused element after closing the child dialog", async () => {
    function NestedDialogs() {
      const [parentOpen, setParentOpen] = useState(false)
      const [childOpen, setChildOpen] = useState(false)

      return (
        <>
          <button type="button" onClick={() => setParentOpen(true)}>
            Open parent
          </button>
          <Dialog open={parentOpen} onOpenChange={setParentOpen}>
            <Dialog.Content>
              <Dialog.Title>Parent dialog</Dialog.Title>
              <button type="button" onClick={() => setChildOpen(true)}>
                Open child
              </button>
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

    await userEvent.click(screen.getByRole("button", { name: "Open parent" }))
    const childOpener = screen.getByRole("button", { name: "Open child" })
    await userEvent.click(childOpener)

    const childDialog = screen.getByRole("dialog", { name: "Child dialog" })
    await userEvent.click(screen.getByRole("button", { name: "Close child" }))
    await waitFor(() => expect(childDialog).toHaveAttribute("data-state", "closed"))
    fireEvent.animationEnd(childDialog)

    // Parent dialog should still be open and focus should return to childOpener
    const parentDialog = screen.getByRole("dialog", { name: "Parent dialog" })
    expect(parentDialog).toHaveAttribute("data-state", "open")
    await waitFor(() => expect(childOpener).toHaveFocus())
  })

  it("keeps both dialogs open when stacked, with the topmost remaining interactive", async () => {
    render(
      <>
        <Dialog defaultOpen>
          <Dialog.Content>
            <Dialog.Title>Dialog 1</Dialog.Title>
            <Dialog.Body>First body</Dialog.Body>
          </Dialog.Content>
        </Dialog>
        <Dialog defaultOpen>
          <Dialog.Content>
            <Dialog.Title>Dialog 2</Dialog.Title>
            <Dialog.Body>Second body</Dialog.Body>
          </Dialog.Content>
        </Dialog>
      </>
    )

    const dialogs = screen.getAllByRole("dialog")
    expect(dialogs).toHaveLength(2)
    expect(dialogs[0]).toHaveAttribute("data-state", "open")
    expect(dialogs[1]).toHaveAttribute("data-state", "open")
  })
})
