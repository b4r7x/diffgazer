import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { axe } from "../../../testing/utils"
import { describe, it, expect, expectTypeOf, vi } from "vitest"
import {
  getEncodedListboxItemId,
  useListbox,
  type UseListboxOptions,
  type UseListboxReturn,
} from "../use-listbox"

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

    expect(onHighlight).toHaveBeenLastCalledWith("a")
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
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
    const user = userEvent.setup({
      delay: null,
      advanceTimers: (delay) => {
        vi.advanceTimersByTime(delay)
      },
    })
    const keyboard = async (text: string) => {
      const typing = user.keyboard(text)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      await typing
    }

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

    try {
      render(<NestedListbox />)
      screen.getByRole("listbox", { name: "Outer" }).focus()
      await keyboard("b")

      expect(onHighlight).not.toHaveBeenCalled()

      act(() => {
        vi.advanceTimersByTime(600)
      })
      await keyboard("c")
      expect(onHighlight).toHaveBeenCalledWith("charlie")
    } finally {
      vi.clearAllTimers()
      vi.useRealTimers()
    }
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

    expect(onHighlight).toHaveBeenLastCalledWith("a2")
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
    expect(onHighlight).toHaveBeenLastCalledWith("s1")

    await user.keyboard("s")
    expect(onHighlight).toHaveBeenLastCalledWith("s2")

    await user.keyboard("s")
    expect(onHighlight).toHaveBeenLastCalledWith("s3")

    await user.keyboard("s")
    expect(onHighlight).toHaveBeenLastCalledWith("s1")
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

  describe("types", () => {
    it("narrows selectedId/onSelect to the supplied union", () => {
      type Narrow = UseListboxOptions<"a" | "b">;
      type ReturnNarrow = UseListboxReturn<"a" | "b">;

      expectTypeOf<Narrow["selectedId"]>().toEqualTypeOf<"a" | "b" | null | undefined>();
      expectTypeOf<NonNullable<Narrow["onSelect"]>>().parameter(0).toEqualTypeOf<"a" | "b">();
      expectTypeOf<ReturnNarrow["selectedId"]>().toEqualTypeOf<"a" | "b" | null>();
    });

    it("keeps the loose default contract when no generic is supplied", () => {
      expectTypeOf<UseListboxOptions["selectedId"]>().toEqualTypeOf<string | null | undefined>();
      expectTypeOf<UseListboxReturn["selectedId"]>().toEqualTypeOf<string | null>();
    });
  });
})
