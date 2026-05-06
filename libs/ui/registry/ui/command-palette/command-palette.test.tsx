import { render, screen, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { axe } from "../../../testing/utils.js"
import { describe, it, expect, vi } from "vitest"
import { CommandPalette } from "./index.js"

interface RenderOptions {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  search?: string
  onSearchChange?: (value: string) => void
  selectedId?: string | null
  onSelectedIdChange?: (id: string | null) => void
  onActivate?: (id: string) => void
  shouldFilter?: boolean
  filter?: (value: string, search: string) => boolean
}

function getOption(id: string) {
  return document.getElementById(id) as HTMLElement
}

function renderPalette(props: RenderOptions = {}) {
  const { open = true, ...rest } = props
  return render(
    <CommandPalette open={open} {...rest}>
      <CommandPalette.Content>
        <CommandPalette.Input />
        <CommandPalette.List>
          <CommandPalette.Item id="copy">Copy</CommandPalette.Item>
          <CommandPalette.Item id="paste">Paste</CommandPalette.Item>
          <CommandPalette.Item id="delete">Delete</CommandPalette.Item>
        </CommandPalette.List>
        <CommandPalette.Empty>No results found</CommandPalette.Empty>
      </CommandPalette.Content>
    </CommandPalette>
  )
}

describe("CommandPalette", () => {
  it("does not render content when closed", () => {
    renderPalette({ open: false })
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
  })

  it("filters items based on search input and shows empty state", async () => {
    renderPalette()
    const input = screen.getByRole("combobox")
    await userEvent.type(input, "cop")
    expect(getOption("copy")).toBeInTheDocument()
    expect(document.getElementById("paste")).not.toBeInTheDocument()
    expect(document.getElementById("delete")).not.toBeInTheDocument()

    await userEvent.clear(input)
    await userEvent.type(input, "zzzzz")
    expect(screen.getByText("No results found")).toBeInTheDocument()
  })

  it("uses a custom filter function", async () => {
    const customFilter = (_value: string, search: string) => search === "magic"
    renderPalette({ filter: customFilter })
    const input = screen.getByRole("combobox")
    await userEvent.type(input, "magic")
    expect(getOption("copy")).toBeInTheDocument()
    expect(getOption("paste")).toBeInTheDocument()
  })

  it("skips filtering when shouldFilter is false", async () => {
    renderPalette({ shouldFilter: false })
    const input = screen.getByRole("combobox")
    await userEvent.type(input, "zzzzz")
    expect(getOption("copy")).toBeInTheDocument()
    expect(getOption("paste")).toBeInTheDocument()
    expect(getOption("delete")).toBeInTheDocument()
  })

  it("activates item on click, calls onSelect, closes palette, and skips disabled items", async () => {
    const onActivate = vi.fn()
    const onOpenChange = vi.fn()
    const onSelect = vi.fn()
    render(
      <CommandPalette open onActivate={onActivate} onOpenChange={onOpenChange}>
        <CommandPalette.Content>
          <CommandPalette.Input />
          <CommandPalette.List>
            <CommandPalette.Item id="nope" disabled>Nope</CommandPalette.Item>
            <CommandPalette.Item id="paste" onSelect={onSelect}>Paste</CommandPalette.Item>
          </CommandPalette.List>
        </CommandPalette.Content>
      </CommandPalette>
    )

    // Disabled item does not activate
    await userEvent.click(getOption("nope"))
    expect(onActivate).not.toHaveBeenCalled()

    // Enabled item activates, calls onSelect, and closes
    await userEvent.click(getOption("paste"))
    expect(onActivate).toHaveBeenCalledWith("paste")
    expect(onSelect).toHaveBeenCalledOnce()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("auto-selects the first item and updates after filtering", async () => {
    renderPalette()
    expect(screen.getByRole("listbox", { name: "Command results" })).toBeInTheDocument()
    expect(getOption("copy")).toHaveAttribute("aria-selected", "true")

    const input = screen.getByRole("combobox")
    await userEvent.type(input, "del")
    expect(getOption("delete")).toHaveAttribute("aria-selected", "true")
  })

  it("controlled search calls onSearchChange without updating internally", async () => {
    const onSearchChange = vi.fn()
    renderPalette({ search: "", onSearchChange })
    const input = screen.getByRole("combobox")
    await userEvent.type(input, "x")
    expect(onSearchChange).toHaveBeenCalledWith("x")
    expect(input).toHaveValue("")
  })

  it("controlled selectedId calls onSelectedIdChange on navigation", async () => {
    const onSelectedIdChange = vi.fn()
    renderPalette({ selectedId: "copy", onSelectedIdChange })
    const input = screen.getByRole("combobox")
    await userEvent.type(input, "{ArrowDown}")
    expect(onSelectedIdChange).toHaveBeenCalled()
  })

  it("has no a11y violations when open or closed", async () => {
    const { container, rerender } = renderPalette()
    expect(await axe(container)).toHaveNoViolations()

    rerender(
      <CommandPalette open={false}>
        <CommandPalette.Content>
          <CommandPalette.Input />
          <CommandPalette.List>
            <CommandPalette.Item id="copy">Copy</CommandPalette.Item>
          </CommandPalette.List>
        </CommandPalette.Content>
      </CommandPalette>
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  it("navigates items with ArrowDown/ArrowUp and wraps around", async () => {
    renderPalette()
    const input = screen.getByRole("combobox")
    expect(getOption("copy")).toHaveAttribute("aria-selected", "true")

    await userEvent.type(input, "{ArrowDown}")
    expect(getOption("paste")).toHaveAttribute("aria-selected", "true")
    expect(getOption("copy")).toHaveAttribute("aria-selected", "false")

    await userEvent.type(input, "{ArrowDown}")
    expect(getOption("delete")).toHaveAttribute("aria-selected", "true")

    await userEvent.type(input, "{ArrowUp}")
    expect(getOption("paste")).toHaveAttribute("aria-selected", "true")

    // Wrap around: one more ArrowDown from delete goes back to copy
    await userEvent.type(input, "{ArrowDown}{ArrowDown}")
    expect(getOption("copy")).toHaveAttribute("aria-selected", "true")
  })

  it("activates the selected item on Enter", async () => {
    const onActivate = vi.fn()
    renderPalette({ onActivate })
    const input = screen.getByRole("combobox")
    await userEvent.type(input, "{ArrowDown}")
    await userEvent.type(input, "{Enter}")
    expect(onActivate).toHaveBeenCalledWith("paste")
  })

  it("closes on Escape via dialog cancel, and clears search first when non-empty", async () => {
    const onOpenChange = vi.fn()
    renderPalette({ onOpenChange })
    const input = screen.getByRole("combobox")

    // With search text, cancel clears search instead of closing
    await userEvent.type(input, "cop")
    expect(input).toHaveValue("cop")
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { bubbles: false }))
    expect(input).toHaveValue("")

    // With empty search, cancel closes
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { bubbles: false }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("Space types in the search input without activating items", async () => {
    const onActivate = vi.fn()
    render(
      <CommandPalette open onActivate={onActivate}>
        <CommandPalette.Content>
          <CommandPalette.Input placeholder="Search..." />
          <CommandPalette.List>
            <CommandPalette.Item id="item-1">Item One</CommandPalette.Item>
          </CommandPalette.List>
        </CommandPalette.Content>
      </CommandPalette>
    )
    const input = screen.getByRole("combobox")
    input.focus()
    await userEvent.type(input, "hello world")
    expect(input).toHaveValue("hello world")
    expect(onActivate).not.toHaveBeenCalled()
  })

  it("restores focus to previously-focused element after close", () => {
    const trigger = document.createElement("button")
    trigger.textContent = "External"
    document.body.appendChild(trigger)
    trigger.focus()

    const { rerender } = render(
      <CommandPalette open>
        <CommandPalette.Content>
          <CommandPalette.Input />
          <CommandPalette.List>
            <CommandPalette.Item id="one">One</CommandPalette.Item>
          </CommandPalette.List>
        </CommandPalette.Content>
      </CommandPalette>
    )

    rerender(
      <CommandPalette open={false}>
        <CommandPalette.Content>
          <CommandPalette.Input />
          <CommandPalette.List>
            <CommandPalette.Item id="one">One</CommandPalette.Item>
          </CommandPalette.List>
        </CommandPalette.Content>
      </CommandPalette>
    )

    const dialog = document.querySelector("dialog")
    if (dialog) fireEvent.animationEnd(dialog)

    expect(trigger).toHaveFocus()

    document.body.removeChild(trigger)
  })
})
