import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { axe } from "../../../testing/utils.js"
import { describe, it, expect, vi } from "vitest"
import { useListbox, type UseListboxOptions } from "../use-listbox.js"

function Listbox(props: Partial<UseListboxOptions> & { items: { id: string; label: string; disabled?: boolean }[] }) {
  const { items, ...opts } = props
  const {
    selectedId,
    highlightedId,
    handleItemHighlight,
    handleItemActivate,
    getContainerProps,
  } = useListbox({ idPrefix: "lb", ...opts })

  return (
    <div {...getContainerProps()} data-testid="listbox" aria-label="Test listbox">
      {items.map((item) => (
        <div
          key={item.id}
          id={`lb-${item.id}`}
          role={opts.itemRole ?? "option"}
          data-value={item.id}
          aria-selected={selectedId === item.id}
          aria-disabled={item.disabled || undefined}
          onMouseEnter={() => handleItemHighlight(item.id)}
          onClick={() => !item.disabled && handleItemActivate(item.id)}
        >
          {item.label}
        </div>
      ))}
    </div>
  )
}

const defaultItems = [
  { id: "a", label: "Alpha" },
  { id: "b", label: "Beta" },
  { id: "c", label: "Charlie" },
]

describe("useListbox", () => {
  it("renders with listbox role and tabindex", () => {
    render(<Listbox items={defaultItems} />)
    const listbox = screen.getByRole("listbox")
    expect(listbox).toBeInTheDocument()
    expect(listbox).toHaveAttribute("tabindex", "0")
  })

  it("has no axe violations", async () => {
    const { container } = render(<Listbox items={defaultItems} />)
    expect(await axe(container)).toHaveNoViolations()
  })

  it("sets aria-activedescendant and fires onHighlightChange on ArrowDown", async () => {
    const onHighlight = vi.fn()
    const user = userEvent.setup()
    render(<Listbox items={defaultItems} onHighlightChange={onHighlight} />)

    const listbox = screen.getByRole("listbox")
    listbox.focus()
    await user.keyboard("{ArrowDown}")

    expect(listbox).toHaveAttribute("aria-activedescendant", "lb-a")
    expect(onHighlight).toHaveBeenCalledWith("a")
  })

  it("selects item on Enter key", async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<Listbox items={defaultItems} onSelect={onSelect} />)

    const listbox = screen.getByRole("listbox")
    listbox.focus()
    await user.keyboard("{ArrowDown}{Enter}")

    expect(onSelect).toHaveBeenCalledWith("a")
  })

  it("selects item on Space key", async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<Listbox items={defaultItems} onSelect={onSelect} />)

    const listbox = screen.getByRole("listbox")
    listbox.focus()
    await user.keyboard("{ArrowDown} ")

    expect(onSelect).toHaveBeenCalledWith("a")
  })

  it("supports menu role", async () => {
    render(<Listbox items={defaultItems} role="menu" itemRole="menuitem" />)
    const menu = screen.getByRole("menu")
    expect(menu).toBeInTheDocument()
    expect(screen.getAllByRole("menuitem")).toHaveLength(3)
  })

  it("supports controlled selectedId", () => {
    render(<Listbox items={defaultItems} selectedId="b" />)
    const listbox = screen.getByRole("listbox")
    expect(listbox).toHaveAttribute("aria-activedescendant", "lb-b")
  })

  it("removes aria-activedescendant when the active item is removed", async () => {
    const { rerender } = render(<Listbox items={defaultItems} selectedId="b" />)
    const listbox = screen.getByRole("listbox")
    expect(listbox).toHaveAttribute("aria-activedescendant", "lb-b")

    rerender(<Listbox items={defaultItems.filter((item) => item.id !== "b")} selectedId="b" />)
    await waitFor(() => expect(listbox).not.toHaveAttribute("aria-activedescendant"))
  })

  it("forwards custom onKeyDown handler with the keyboard event", async () => {
    const onKeyDown = vi.fn()
    const user = userEvent.setup()
    render(<Listbox items={defaultItems} onKeyDown={onKeyDown} />)

    const listbox = screen.getByRole("listbox")
    listbox.focus()
    await user.keyboard("{ArrowDown}")

    expect(onKeyDown).toHaveBeenCalledWith(expect.objectContaining({ key: "ArrowDown" }))
  })

  it("selects item on click and fires onSelect", async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<Listbox items={defaultItems} onSelect={onSelect} />)

    const option = screen.getByText("Beta")
    await user.click(option)

    expect(onSelect).toHaveBeenCalledWith("b")
    expect(option).toHaveAttribute("aria-selected", "true")
  })

  it("wraps from last item to first with wrap=true (default)", async () => {
    const onHighlight = vi.fn()
    const user = userEvent.setup()
    render(<Listbox items={defaultItems} defaultHighlightedId="c" onHighlightChange={onHighlight} />)

    const listbox = screen.getByRole("listbox")
    listbox.focus()

    await user.keyboard("{ArrowDown}")

    const lastCall = onHighlight.mock.calls[onHighlight.mock.calls.length - 1]
    expect(lastCall?.[0]).toBe("a")
  })

  it("skips aria-disabled items in typeahead", async () => {
    const items = [
      { id: "d", label: "Disabled", disabled: true },
      { id: "a", label: "Alpha" },
      { id: "b", label: "Beta" },
    ]
    const onHighlight = vi.fn()
    const user = userEvent.setup()
    render(<Listbox items={items} typeahead onHighlightChange={onHighlight} />)

    const listbox = screen.getByRole("listbox")
    listbox.focus()
    await user.keyboard("a")

    const lastCall = onHighlight.mock.calls[onHighlight.mock.calls.length - 1]
    expect(lastCall?.[0]).toBe("a")
  })
})
