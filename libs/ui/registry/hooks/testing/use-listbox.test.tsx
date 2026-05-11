import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { axe } from "../../../testing/utils.js"
import { describe, it, expect, vi } from "vitest"
import { getEncodedListboxItemId, useListbox, type UseListboxOptions } from "../use-listbox.js"

type ListboxItem = { id: string; label: string; disabled?: boolean }

function Listbox(
  props: Omit<Partial<UseListboxOptions>, "items"> & {
    items: ListboxItem[]
    provideItemsMetadata?: boolean
  },
) {
  const { items, provideItemsMetadata = true, ...opts } = props
  const hookItems = provideItemsMetadata
    ? items.map((item) => ({ id: item.id, disabled: item.disabled }))
    : undefined
  const {
    selectedId,
    highlighted,
    handleItemActivate,
    getContainerProps,
  } = useListbox({
    idPrefix: "lb",
    ...(hookItems === undefined ? {} : { items: hookItems }),
    ...opts,
  })
  const getDomItemId = opts.getItemId ?? getEncodedListboxItemId

  return (
    <div {...getContainerProps()} aria-label="Test listbox">
      {items.map((item) => (
        <div
          key={item.id}
          id={getDomItemId("lb", item.id)}
          role={opts.itemRole ?? "option"}
          data-value={item.id}
          aria-selected={selectedId === item.id}
          aria-disabled={item.disabled || undefined}
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

    expect(listbox).toHaveAttribute("aria-activedescendant", getEncodedListboxItemId("lb", "a"))
    expect(onHighlight).toHaveBeenCalledWith("a")
  })

  it("selects item on Enter key", async () => {
    const onSelect = vi.fn()
    const onEnter = vi.fn()
    const user = userEvent.setup()
    render(<Listbox items={defaultItems} onSelect={onSelect} onEnter={onEnter} />)

    const listbox = screen.getByRole("listbox")
    listbox.focus()
    await user.keyboard("{ArrowDown}{Enter}")

    expect(onSelect).toHaveBeenCalledWith("a")
    expect(onEnter).toHaveBeenCalledWith("a", expect.any(KeyboardEvent))
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
    expect(listbox).toHaveAttribute("aria-activedescendant", getEncodedListboxItemId("lb", "b"))
  })

  it("uses the selected item as the keyboard navigation anchor", async () => {
    const user = userEvent.setup()
    render(<Listbox items={defaultItems} defaultSelectedId="b" />)

    const listbox = screen.getByRole("listbox")
    listbox.focus()
    await user.keyboard("{ArrowDown}")

    expect(listbox).toHaveAttribute("aria-activedescendant", getEncodedListboxItemId("lb", "c"))
  })

  it("removes aria-activedescendant when the active item is removed", async () => {
    const { rerender } = render(<Listbox items={defaultItems} selectedId="b" />)
    const listbox = screen.getByRole("listbox")
    expect(listbox).toHaveAttribute("aria-activedescendant", getEncodedListboxItemId("lb", "b"))

    rerender(<Listbox items={defaultItems.filter((item) => item.id !== "b")} selectedId="b" />)
    await waitFor(() => expect(listbox).not.toHaveAttribute("aria-activedescendant"))
  })

  it("removes aria-activedescendant when the active item is removed without item metadata", async () => {
    const { rerender } = render(<Listbox items={defaultItems} selectedId="b" provideItemsMetadata={false} />)
    const listbox = screen.getByRole("listbox")
    await waitFor(() => expect(listbox).toHaveAttribute("aria-activedescendant", getEncodedListboxItemId("lb", "b")))

    rerender(
      <Listbox
        items={defaultItems.filter((item) => item.id !== "b")}
        selectedId="b"
        provideItemsMetadata={false}
      />,
    )
    await waitFor(() => expect(listbox).not.toHaveAttribute("aria-activedescendant"))
  })

  it("does not activate a removed highlighted item", async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    const { rerender } = render(<Listbox items={defaultItems} highlighted="b" onSelect={onSelect} />)

    rerender(<Listbox items={defaultItems.filter((item) => item.id !== "b")} highlighted="b" onSelect={onSelect} />)
    screen.getByRole("listbox").focus()
    await user.keyboard("{Enter}")

    expect(onSelect).not.toHaveBeenCalled()
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
    render(<Listbox items={defaultItems} defaultHighlighted="c" onHighlightChange={onHighlight} />)

    const listbox = screen.getByRole("listbox")
    listbox.focus()

    await user.keyboard("{ArrowDown}")

    const lastCall = onHighlight.mock.calls[onHighlight.mock.calls.length - 1]
    expect(lastCall?.[0]).toBe("a")
  })

  it("reports navigation boundaries when wrapping is disabled", async () => {
    const onBoundary = vi.fn()
    const user = userEvent.setup()
    render(
      <Listbox
        items={defaultItems}
        defaultHighlighted="a"
        wrap={false}
        onNavigationBoundaryReached={onBoundary}
      />,
    )

    const listbox = screen.getByRole("listbox")
    listbox.focus()

    await user.keyboard("{ArrowUp}{End}{ArrowDown}")

    expect(onBoundary).toHaveBeenCalledWith("previous", expect.any(KeyboardEvent), expect.any(String))
    expect(onBoundary).toHaveBeenCalledWith("next", expect.any(KeyboardEvent), expect.any(String))
  })

  it("skips disabled items during keyboard navigation", async () => {
    const user = userEvent.setup()
    render(
      <Listbox
        items={[
          { id: "a", label: "Alpha" },
          { id: "b", label: "Beta", disabled: true },
          { id: "c", label: "Charlie" },
        ]}
        defaultHighlighted="a"
      />,
    )

    const listbox = screen.getByRole("listbox")
    listbox.focus()
    await user.keyboard("{ArrowDown}")

    expect(listbox).toHaveAttribute("aria-activedescendant", getEncodedListboxItemId("lb", "c"))
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

  it("includes disabled menu items in typeahead focus without activating them", async () => {
    const onHighlight = vi.fn()
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(
      <Listbox
        role="menu"
        itemRole="menuitem"
        items={[
          { id: "disabled-beta", label: "Beta", disabled: true },
          { id: "bravo", label: "Bravo" },
        ]}
        typeahead
        onHighlightChange={onHighlight}
        onSelect={onSelect}
      />,
    )

    const menu = screen.getByRole("menu")
    menu.focus()
    await user.keyboard("b{Enter}")

    expect(onHighlight).toHaveBeenCalledWith("disabled-beta")
    expect(menu).toHaveAttribute("aria-activedescendant", getEncodedListboxItemId("lb", "disabled-beta"))
    expect(onSelect).not.toHaveBeenCalled()
  })

  it("keeps typeahead scoped away from nested listboxes", async () => {
    const onHighlight = vi.fn()
    const user = userEvent.setup()

    function NestedListbox() {
      const { getContainerProps } = useListbox({
        idPrefix: "outer",
        onHighlightChange: onHighlight,
        typeahead: true,
      })

      return (
        <div {...getContainerProps()} aria-label="Outer">
          <div id="outer-alpha" role="option" data-value="alpha">Alpha</div>
          <div role="listbox" aria-label="Nested">
            <div id="outer-beta" role="option" data-value="beta">Beta</div>
          </div>
          <div id="outer-charlie" role="option" data-value="charlie">Charlie</div>
        </div>
      )
    }

    render(<NestedListbox />)
    screen.getByRole("listbox", { name: "Outer" }).focus()
    await user.keyboard("b")

    expect(onHighlight).not.toHaveBeenCalled()

    await new Promise((resolve) => setTimeout(resolve, 600))
    await user.keyboard("c")
    expect(onHighlight).toHaveBeenCalledWith("charlie")
  })

  it("does not update outer typeahead when key bubbles from a focused inner composite", async () => {
    const onHighlight = vi.fn()
    const user = userEvent.setup()

    function NestedFocusableListbox() {
      const { getContainerProps } = useListbox({
        idPrefix: "outer",
        onHighlightChange: onHighlight,
        typeahead: true,
      })

      return (
        <div {...getContainerProps()} aria-label="Outer">
          <div id="outer-alpha" role="option" data-value="alpha">Alpha</div>
          <div role="listbox" aria-label="Nested" tabIndex={0}>
            <div id="outer-beta" role="option" data-value="beta">Beta</div>
          </div>
          <div id="outer-charlie" role="option" data-value="charlie">Charlie</div>
        </div>
      )
    }

    render(<NestedFocusableListbox />)
    screen.getByRole("listbox", { name: "Nested" }).focus()
    await user.keyboard("c")

    expect(onHighlight).not.toHaveBeenCalled()
  })

  it("starts typeahead search after the current highlighted item", async () => {
    const items = [
      { id: "a1", label: "Alpha" },
      { id: "a2", label: "Apricot" },
      { id: "a3", label: "Avocado" },
    ]
    const onHighlight = vi.fn()
    const user = userEvent.setup()
    render(<Listbox items={items} defaultHighlighted="a1" typeahead onHighlightChange={onHighlight} />)

    const listbox = screen.getByRole("listbox")
    listbox.focus()
    await user.keyboard("a")

    const lastCall = onHighlight.mock.calls[onHighlight.mock.calls.length - 1]
    expect(lastCall?.[0]).toBe("a2")
  })

  it("cycles through items sharing a prefix on repeated character press", async () => {
    const items = [
      { id: "s1", label: "Strawberry" },
      { id: "s2", label: "Sage" },
      { id: "s3", label: "Salmon" },
      { id: "o", label: "Orange" },
    ]
    const onHighlight = vi.fn()
    const user = userEvent.setup()
    render(<Listbox items={items} typeahead onHighlightChange={onHighlight} />)

    const listbox = screen.getByRole("listbox")
    listbox.focus()
    await user.keyboard("s")
    expect(onHighlight.mock.calls.at(-1)?.[0]).toBe("s1")

    await user.keyboard("s")
    expect(onHighlight.mock.calls.at(-1)?.[0]).toBe("s2")

    await user.keyboard("s")
    expect(onHighlight.mock.calls.at(-1)?.[0]).toBe("s3")

    await user.keyboard("s")
    expect(onHighlight.mock.calls.at(-1)?.[0]).toBe("s1")
  })

  it("uses aria-label text for typeahead matching", async () => {
    const onHighlight = vi.fn()
    const user = userEvent.setup()

    function LabelledListbox() {
      const { getContainerProps } = useListbox({
        idPrefix: "lb",
        typeahead: true,
        onHighlightChange: onHighlight,
      })

      return (
        <div {...getContainerProps()} aria-label="Test listbox">
          <div id="lb-icon" role="option" data-value="icon" aria-label="Zebra">
            Icon
          </div>
        </div>
      )
    }

    render(<LabelledListbox />)
    screen.getByRole("listbox").focus()
    await user.keyboard("z")

    expect(onHighlight).toHaveBeenCalledWith("icon")
  })

  it("uses aria-labelledby text for typeahead matching", async () => {
    const onHighlight = vi.fn()
    const user = userEvent.setup()

    function LabelledByListbox() {
      const { getContainerProps } = useListbox({
        idPrefix: "lb",
        typeahead: true,
        onHighlightChange: onHighlight,
      })

      return (
        <div {...getContainerProps()} aria-label="Test listbox">
          <span id="omega-label">Omega</span>
          <div id="lb-symbol" role="option" data-value="symbol" aria-labelledby="omega-label">
            Symbol
          </div>
        </div>
      )
    }

    render(<LabelledByListbox />)
    screen.getByRole("listbox").focus()
    await user.keyboard("o")

    expect(onHighlight).toHaveBeenCalledWith("symbol")
  })

  it("treats empty string as a valid selected and highlighted item id", async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(
      <Listbox
        items={[
          { id: "", label: "None" },
          { id: "a b/slash", label: "Special" },
        ]}
        defaultHighlighted=""
        onSelect={onSelect}
      />,
    )

    const listbox = screen.getByRole("listbox")
    expect(listbox).toHaveAttribute("aria-activedescendant", getEncodedListboxItemId("lb", ""))
    expect(document.getElementById(getEncodedListboxItemId("lb", ""))).toHaveTextContent("None")

    listbox.focus()
    await user.keyboard("{Enter}")

    expect(onSelect).toHaveBeenCalledWith("")
  })

  it("uses DOM-safe generated ids for special public values", () => {
    render(
      <Listbox
        items={[
          { id: "a b/slash", label: "Special" },
        ]}
        selectedId="a b/slash"
      />,
    )

    const listbox = screen.getByRole("listbox")
    const activeDescendant = listbox.getAttribute("aria-activedescendant")
    expect(activeDescendant).toBe(getEncodedListboxItemId("lb", "a b/slash"))
    expect(activeDescendant).not.toContain(" ")
    expect(activeDescendant).not.toContain("/")
    expect(document.getElementById(activeDescendant!)).toHaveTextContent("Special")
  })
})
