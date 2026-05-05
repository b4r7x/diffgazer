import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { Dialog } from "../dialog/index.js"
import { Popover } from "../popover/index.js"

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

})
