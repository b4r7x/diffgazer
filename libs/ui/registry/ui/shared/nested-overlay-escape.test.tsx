import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
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
