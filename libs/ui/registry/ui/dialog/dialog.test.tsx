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
    // Both dialogs should be present in DOM
    expect(dialogs).toHaveLength(2)
    // The last opened dialog should be focused/visible
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
    // Close the top dialog
    const closeButtons = screen.getAllByRole("button", { name: "Close dialog" })
    await userEvent.click(closeButtons[closeButtons.length - 1])
    expect(onOpenChange2).toHaveBeenCalledWith(false)
  })
})
