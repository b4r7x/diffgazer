import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Dialog } from "../dialog/index"
import { Popover } from "../popover/index"
import { Select } from "../select/index"

// axe skipped: portal-tree integration test; dialog/popover/select primitive tests own a11y assertions.

describe("Portal-in-Dialog focus containment", () => {
  it("popover inside dialog renders within the dialog DOM tree", async () => {
    render(
      <Dialog defaultOpen>
        <Dialog.Trigger>Open Dialog</Dialog.Trigger>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>Test Dialog</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>
            <Popover triggerMode="click" defaultOpen>
              <Popover.Trigger>Open Popover</Popover.Trigger>
              <Popover.Content>
                <p>Popover content</p>
              </Popover.Content>
            </Popover>
          </Dialog.Body>
        </Dialog.Content>
      </Dialog>
    )

    const dialog = screen.getByRole("dialog", { name: "Test Dialog" })
    const popoverContent = screen.getByText("Popover content")

    expect(dialog.contains(popoverContent)).toBe(true)
  })

  it("default-variant select inside dialog portals listbox into the dialog DOM tree", async () => {
    render(
      <Dialog defaultOpen>
        <Dialog.Content>
          <Dialog.Title>Test Dialog</Dialog.Title>
          <Dialog.Body>
            <Select variant="default" defaultOpen>
              <Select.Trigger>
                <Select.Value placeholder="Pick a fruit" />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="apple">Apple</Select.Item>
                <Select.Item value="banana">Banana</Select.Item>
              </Select.Content>
            </Select>
          </Dialog.Body>
        </Dialog.Content>
      </Dialog>
    )

    const dialog = screen.getByRole("dialog", { name: "Test Dialog" })
    const trigger = screen.getByRole("combobox")
    const listboxId = trigger.getAttribute("aria-controls")
    if (!listboxId) throw new Error("Expected combobox to control a listbox")

    const listbox = document.getElementById(listboxId)
    if (!listbox) throw new Error("Expected listbox to be mounted")

    expect(dialog.contains(listbox)).toBe(true)
    expect(listbox.parentElement).not.toBe(document.body)
  })
})
