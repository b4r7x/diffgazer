import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { axe } from "../../../testing/utils.js"
import { afterEach, describe, it, expect, vi } from "vitest"
import { CommandPalette } from "./index.js"
import { StrictMode, createRef } from "react"
import { Popover } from "../popover/index.js"

afterEach(() => {
  vi.restoreAllMocks()
})

interface RenderOptions {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  search?: string
  onSearchChange?: (value: string) => void
  highlightedId?: string | null
  onHighlightChange?: (id: string | null) => void
  onActivate?: (id: string) => void
  shouldFilter?: boolean
  filter?: (value: string, search: string) => boolean
}

function getOption(id: string) {
  const option = Array.from(document.querySelectorAll<HTMLElement>('[role="option"]'))
    .find((element) => element.dataset.value === id)
  if (!option) throw new Error(`Option not found: ${id}`)
  return option
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
  it("supports direct namespaced parts inside groups", async () => {
    const onActivate = vi.fn()
    render(
      <CommandPalette open onActivate={onActivate}>
        <CommandPalette.Content>
          <CommandPalette.Input />
          <CommandPalette.List>
            <CommandPalette.Group heading="Actions">
              <CommandPalette.Item id="copy">Copy</CommandPalette.Item>
              <CommandPalette.Item id="paste">Paste</CommandPalette.Item>
            </CommandPalette.Group>
          </CommandPalette.List>
        </CommandPalette.Content>
      </CommandPalette>,
    )

    await userEvent.type(screen.getByRole("combobox"), "{ArrowDown}{Enter}")

    expect(onActivate).toHaveBeenCalledWith("paste")
  })

  it("supports keyboard activation for items rendered by wrappers", async () => {
    const onActivate = vi.fn()
    function WrappedCommandItem() {
      return <CommandPalette.Item id="wrapped">Wrapped</CommandPalette.Item>
    }

    render(
      <CommandPalette open onActivate={onActivate}>
        <CommandPalette.Content>
          <CommandPalette.Input />
          <CommandPalette.List>
            <CommandPalette.Item id="direct">Direct</CommandPalette.Item>
            <WrappedCommandItem />
          </CommandPalette.List>
        </CommandPalette.Content>
      </CommandPalette>,
    )

    expect(screen.getByRole("option", { name: /wrapped/i })).toBeInTheDocument()

    await userEvent.type(screen.getByRole("combobox"), "wrapped{Enter}")

    expect(onActivate).toHaveBeenCalledWith("wrapped")
  })

  it("does not render content when closed", () => {
    renderPalette({ open: false })
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
  })

  it("exposes modal dialog semantics", () => {
    renderPalette()
    expect(screen.getByRole("dialog", { name: "Command palette" })).toHaveAttribute("aria-modal", "true")
  })

  it("focuses the combobox immediately when opened", () => {
    renderPalette()
    expect(screen.getByRole("combobox")).toHaveFocus()
  })

  it("filters items based on search input and shows empty state", async () => {
    renderPalette()
    const input = screen.getByRole("combobox")
    await userEvent.type(input, "cop")
    expect(getOption("copy")).toBeInTheDocument()
    expect(screen.queryByRole("option", { name: "Paste" })).not.toBeInTheDocument()
    expect(screen.queryByRole("option", { name: "Delete" })).not.toBeInTheDocument()

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

    await userEvent.click(getOption("nope"))
    expect(onActivate).not.toHaveBeenCalled()

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

  it("keeps item registration current under StrictMode filtering", async () => {
    const onActivate = vi.fn()
    render(
      <StrictMode>
        <CommandPalette open onActivate={onActivate}>
          <CommandPalette.Content>
            <CommandPalette.Input />
            <CommandPalette.List>
              <CommandPalette.Item id="copy">Copy</CommandPalette.Item>
              <CommandPalette.Item id="delete">Delete</CommandPalette.Item>
            </CommandPalette.List>
          </CommandPalette.Content>
        </CommandPalette>
      </StrictMode>,
    )

    await userEvent.type(screen.getByRole("combobox"), "del{Enter}")
    expect(onActivate).toHaveBeenCalledWith("delete")
  })

  it("controlled search calls onSearchChange without updating internally", async () => {
    const onSearchChange = vi.fn()
    renderPalette({ search: "", onSearchChange })
    const input = screen.getByRole("combobox")
    await userEvent.type(input, "x")
    expect(onSearchChange).toHaveBeenCalledWith("x")
    expect(input).toHaveValue("")
  })

  it("controlled highlightedId calls onHighlightChange on navigation", async () => {
    const onHighlightChange = vi.fn()
    renderPalette({ highlightedId: "copy", onHighlightChange })
    const input = screen.getByRole("combobox")
    await userEvent.type(input, "{ArrowDown}")
    expect(onHighlightChange).toHaveBeenCalledWith("paste")
  })

  it("keeps controlled null highlight unselected", () => {
    renderPalette({ highlightedId: null })
    expect(screen.getByRole("combobox")).not.toHaveAttribute("aria-activedescendant")
    expect(getOption("copy")).toHaveAttribute("aria-selected", "false")
  })

  it("keeps public item ids separate from DOM-safe active descendant ids", () => {
    render(
      <CommandPalette open highlightedId="a b/slash">
        <CommandPalette.Content>
          <CommandPalette.Input />
          <CommandPalette.List>
            <CommandPalette.Item id="">Empty</CommandPalette.Item>
            <CommandPalette.Item id="a b/slash">Special</CommandPalette.Item>
          </CommandPalette.List>
        </CommandPalette.Content>
      </CommandPalette>,
    )

    const input = screen.getByRole("combobox")
    const special = getOption("a b/slash")
    const empty = getOption("")

    expect(special.id).toBeTruthy()
    expect(empty.id).toBeTruthy()
    expect(special.id).not.toBe("a b/slash")
    expect(empty.id).not.toBe("")
    expect(special.id).not.toBe(empty.id)
    expect(input).toHaveAttribute("aria-activedescendant", special.id)
    expect(document.getElementById(special.id)).toBe(special)
  })

  it("omits stale controlled active descendants for disabled, filtered, and missing items", () => {
    const { rerender } = render(
      <CommandPalette open highlightedId="delete">
        <CommandPalette.Content>
          <CommandPalette.Input />
          <CommandPalette.List>
            <CommandPalette.Item id="copy">Copy</CommandPalette.Item>
            <CommandPalette.Item id="delete" disabled>Delete</CommandPalette.Item>
          </CommandPalette.List>
        </CommandPalette.Content>
      </CommandPalette>,
    )

    expect(screen.getByRole("combobox")).not.toHaveAttribute("aria-activedescendant")

    rerender(
      <CommandPalette open highlightedId="delete" search="copy">
        <CommandPalette.Content>
          <CommandPalette.Input />
          <CommandPalette.List>
            <CommandPalette.Item id="copy">Copy</CommandPalette.Item>
            <CommandPalette.Item id="delete">Delete</CommandPalette.Item>
          </CommandPalette.List>
        </CommandPalette.Content>
      </CommandPalette>,
    )
    expect(screen.getByRole("combobox")).not.toHaveAttribute("aria-activedescendant")

    rerender(
      <CommandPalette open highlightedId="missing">
        <CommandPalette.Content>
          <CommandPalette.Input />
          <CommandPalette.List>
            <CommandPalette.Item id="copy">Copy</CommandPalette.Item>
          </CommandPalette.List>
        </CommandPalette.Content>
      </CommandPalette>,
    )
    expect(screen.getByRole("combobox")).not.toHaveAttribute("aria-activedescendant")
  })

  it("forwards item props and refs while honoring preventDefault", async () => {
    const ref = createRef<HTMLDivElement>()
    const onActivate = vi.fn()
    const onClick = vi.fn((event) => event.preventDefault())

    render(
      <CommandPalette open onActivate={onActivate}>
        <CommandPalette.Content>
          <CommandPalette.Input />
          <CommandPalette.List>
            <CommandPalette.Item id="copy" ref={ref} onClick={onClick}>
              Copy
            </CommandPalette.Item>
          </CommandPalette.List>
        </CommandPalette.Content>
      </CommandPalette>,
    )

    const item = screen.getByRole("option", { name: /Copy/ })
    expect(ref.current).toBe(item)
    await userEvent.click(item)
    expect(onClick).toHaveBeenCalledOnce()
    expect(onActivate).not.toHaveBeenCalled()
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

    await userEvent.type(input, "{ArrowDown}{ArrowDown}")
    expect(getOption("copy")).toHaveAttribute("aria-selected", "true")
  })

  it("lets input key handlers prevent Arrow and Enter navigation", async () => {
    const onActivate = vi.fn()
    render(
      <CommandPalette open onActivate={onActivate}>
        <CommandPalette.Content>
          <CommandPalette.Input onKeyDown={(event) => event.preventDefault()} />
          <CommandPalette.List>
            <CommandPalette.Item id="copy">Copy</CommandPalette.Item>
            <CommandPalette.Item id="paste">Paste</CommandPalette.Item>
          </CommandPalette.List>
        </CommandPalette.Content>
      </CommandPalette>,
    )
    const input = screen.getByRole("combobox")

    await userEvent.type(input, "{ArrowDown}{Enter}")

    expect(getOption("copy")).toHaveAttribute("aria-selected", "true")
    expect(getOption("paste")).toHaveAttribute("aria-selected", "false")
    expect(onActivate).not.toHaveBeenCalled()
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

    await userEvent.type(input, "cop")
    expect(input).toHaveValue("cop")
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { bubbles: false }))
    expect(input).toHaveValue("")

    fireEvent(screen.getByRole("dialog"), new Event("cancel", { bubbles: false }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("clears search on Escape keydown without moving focus or closing", async () => {
    const onOpenChange = vi.fn()
    renderPalette({ onOpenChange })
    const input = screen.getByRole("combobox")

    await userEvent.type(input, "cop{Escape}")

    expect(input).toHaveValue("")
    expect(input).toHaveFocus()
    expect(onOpenChange).not.toHaveBeenCalled()
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

  it("restores focus to previously-focused element after close", async () => {
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
    await waitFor(() => expect(dialog).toHaveAttribute("data-state", "closed"))
    if (dialog) fireEvent.animationEnd(dialog)

    await waitFor(() => expect(trigger).toHaveFocus())

    document.body.removeChild(trigger)
  })

  it("restores focus after the native dialog closes", async () => {
    const events: string[] = []
    const trigger = document.createElement("button")
    trigger.textContent = "External"
    document.body.appendChild(trigger)
    trigger.focus()

    vi.spyOn(trigger, "focus").mockImplementation(() => {
      events.push("focus")
    })
    vi.spyOn(HTMLDialogElement.prototype, "close").mockImplementation(function close(this: HTMLDialogElement) {
      events.push("close")
      this.removeAttribute("open")
    })

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
    await waitFor(() => expect(dialog).toHaveAttribute("data-state", "closed"))
    if (dialog) fireEvent.animationEnd(dialog)

    await waitFor(() => expect(events).toEqual(["close", "focus"]))

    document.body.removeChild(trigger)
  })

  it("keeps nested portals inside the command palette dialog", async () => {
    render(
      <CommandPalette open>
        <CommandPalette.Content>
          <CommandPalette.Input />
          <Popover triggerMode="click" defaultOpen>
            <Popover.Trigger>Nested popover trigger</Popover.Trigger>
            <Popover.Content aria-label="Command nested popover">
              <button>Nested action</button>
            </Popover.Content>
          </Popover>
          <CommandPalette.List>
            <CommandPalette.Item id="copy">Copy</CommandPalette.Item>
          </CommandPalette.List>
        </CommandPalette.Content>
      </CommandPalette>
    )

    const dialog = screen.getByRole("dialog", { name: "Command palette" })
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
})
