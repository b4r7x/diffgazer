import { render, screen, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { axe } from "../../../testing/utils.js"
import { describe, it, expect, vi } from "vitest"
import { Dialog } from "./index.js"

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
    fireEvent.click(screen.getByRole("dialog"))
    expect(onOpenChange).toHaveBeenCalledWith(false)
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

    const dialog = document.querySelector("dialog")
    if (dialog) fireEvent.animationEnd(dialog)

    expect(trigger).toHaveFocus()
  })

  // --- ARIA ---

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
    const dialog = screen.getByRole("dialog")
    const title = screen.getByRole("heading", { name: "Test Title" })
    expect(dialog).toHaveAttribute("aria-labelledby", title.id)
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

  // --- Accessibility ---

  it("has no a11y violations when open", async () => {
    const { container } = renderDialog({ defaultOpen: true })
    expect(await axe(container, { rules: { "nested-interactive": { enabled: false } } })).toHaveNoViolations()
  })

  it("has no a11y violations when closed", async () => {
    const { container } = renderDialog()
    expect(await axe(container)).toHaveNoViolations()
  })
})
