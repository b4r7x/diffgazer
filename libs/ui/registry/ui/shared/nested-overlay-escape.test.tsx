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

    // Both should be open: the native dialog + the popover (both role="dialog")
    const dialogs = screen.getAllByRole("dialog")
    expect(dialogs.length).toBeGreaterThanOrEqual(2)

    // Press Escape — popover's document keydown handler should intercept
    await userEvent.keyboard("{Escape}")

    // Popover should have been closed
    expect(onPopoverChange).toHaveBeenCalledWith(false)

    // Dialog's onOpenChange should NOT have been called
    // (popover's handler calls stopPropagation + preventDefault,
    //  preventing the browser from generating a cancel event on the <dialog>)
    expect(onDialogChange).not.toHaveBeenCalled()
  })
})
