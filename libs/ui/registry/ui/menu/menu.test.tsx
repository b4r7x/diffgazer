import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { axe } from "../../../testing/utils.js"
import { describe, it, expect, vi } from "vitest"
import { Menu } from "./index.js"

function renderMenu(props: Record<string, unknown> = {}) {
  return render(
    <Menu aria-label="Test menu" {...props}>
      <Menu.Item id="one">One</Menu.Item>
      <Menu.Item id="two">Two</Menu.Item>
      <Menu.Item id="three" disabled>Three</Menu.Item>
    </Menu>
  )
}

describe("Menu", () => {
  it("fires onSelect when an item is clicked", async () => {
    const onSelect = vi.fn()
    renderMenu({ onSelect })
    await userEvent.click(screen.getByText("One"))
    expect(onSelect).toHaveBeenCalledWith("one")
  })

  it("does not fire onSelect for disabled items and marks them aria-disabled", async () => {
    const onSelect = vi.fn()
    renderMenu({ onSelect })
    const disabledItem = screen.getByText("Three").closest("[role='menuitem']")!
    expect(disabledItem).toHaveAttribute("aria-disabled", "true")
    await userEvent.click(screen.getByText("Three"))
    expect(onSelect).not.toHaveBeenCalled()
  })

  it("highlights item on mouse enter (sets aria-activedescendant)", async () => {
    renderMenu()
    const twoItem = screen.getByText("Two").closest("[role='menuitem']")!
    await userEvent.hover(twoItem)
    expect(screen.getByRole("menu")).toHaveAttribute("aria-activedescendant", twoItem.id)
  })

  it("marks highlighted and selected items active with data-active", async () => {
    renderMenu({ defaultSelectedId: "two" })
    const oneItem = screen.getByText("One").closest("[role='menuitemradio']")!
    const twoItem = screen.getByText("Two").closest("[role='menuitemradio']")!

    expect(twoItem).toHaveAttribute("data-active", "true")
    expect(oneItem).not.toHaveAttribute("data-active")

    await userEvent.hover(oneItem)
    expect(oneItem).toHaveAttribute("data-active", "true")
    expect(twoItem).toHaveAttribute("data-active", "true")
  })

  it("selects defaultSelectedId initially", () => {
    renderMenu({ defaultSelectedId: "two" })
    const item = screen.getByText("Two").closest("[role='menuitemradio']")!
    expect(item).toHaveAttribute("aria-checked", "true")
  })

  it("fires onSelect in controlled mode without internal state change", async () => {
    const onSelect = vi.fn()
    const { rerender } = render(
      <Menu aria-label="Test menu" selectedId="one" onSelect={onSelect}>
        <Menu.Item id="one">One</Menu.Item>
        <Menu.Item id="two">Two</Menu.Item>
      </Menu>
    )
    await userEvent.click(screen.getByText("Two"))
    expect(onSelect).toHaveBeenCalledWith("two")
    expect(screen.getByText("One").closest("[role='menuitemradio']")).toHaveAttribute(
      "aria-checked",
      "true",
    )

    rerender(
      <Menu aria-label="Test menu" selectedId="two" onSelect={onSelect}>
        <Menu.Item id="one">One</Menu.Item>
        <Menu.Item id="two">Two</Menu.Item>
      </Menu>
    )
    expect(screen.getByText("Two").closest("[role='menuitemradio']")).toHaveAttribute(
      "aria-checked",
      "true",
    )
  })

  it("has no a11y violations", async () => {
    const { container } = renderMenu()
    expect(await axe(container)).toHaveNoViolations()
  })

  it("moves highlight with ArrowDown and ArrowUp", async () => {
    renderMenu({ defaultHighlightedId: "one" })
    const menu = screen.getByRole("menu")
    menu.focus()
    await userEvent.keyboard("{ArrowDown}")
    expect(menu).toHaveAttribute(
      "aria-activedescendant",
      expect.stringContaining("-two"),
    )
    await userEvent.keyboard("{ArrowUp}")
    expect(menu).toHaveAttribute(
      "aria-activedescendant",
      expect.stringContaining("-one"),
    )
  })

  it("activates highlighted item with Enter", async () => {
    const onSelect = vi.fn()
    renderMenu({ defaultHighlightedId: "one", onSelect })
    const listbox = screen.getByRole("menu")
    listbox.focus()
    await userEvent.keyboard("{Enter}")
    expect(onSelect).toHaveBeenCalledWith("one")
  })

  it("calls onClose when Escape is pressed", async () => {
    const onClose = vi.fn()
    renderMenu({ onClose, defaultHighlightedId: "one" })
    const menu = screen.getByRole("menu")
    menu.focus()
    await userEvent.keyboard("{Escape}")
    expect(onClose).toHaveBeenCalled()
  })

  it("focuses the container on mount when autoFocus is true", async () => {
    renderMenu({ autoFocus: true, defaultHighlightedId: "one" })
    const menu = screen.getByRole("menu")
    await waitFor(() => {
      expect(menu).toHaveFocus()
    })
  })

  it("renders a divider as a separator", () => {
    render(
      <Menu aria-label="Test menu">
        <Menu.Item id="one">One</Menu.Item>
        <Menu.Divider />
        <Menu.Item id="two">Two</Menu.Item>
      </Menu>
    )
    expect(screen.getByRole("separator")).toBeInTheDocument()
  })
})

describe("Menu typeahead", () => {
  function renderTypeaheadMenu() {
    return render(
      <Menu aria-label="Test menu">
        <Menu.Item id="alpha">Alpha</Menu.Item>
        <Menu.Item id="beta">Beta</Menu.Item>
        <Menu.Item id="charlie">Charlie</Menu.Item>
        <Menu.Item id="cherry">Cherry</Menu.Item>
      </Menu>
    )
  }

  it("highlights item matching typed character", async () => {
    const user = userEvent.setup()
    renderTypeaheadMenu()
    const menu = screen.getByRole("menu")
    await user.click(menu)
    await user.keyboard("b")
    const betaItem = screen.getByText("Beta").closest("[role='menuitem']")!
    expect(menu).toHaveAttribute("aria-activedescendant", betaItem.id)
  })

  it("accumulates characters for multi-char typeahead", async () => {
    const user = userEvent.setup()
    renderTypeaheadMenu()
    const menu = screen.getByRole("menu")
    await user.click(menu)
    await user.keyboard("ch")
    const charlieItem = screen.getByText("Charlie").closest("[role='menuitem']")!
    expect(menu).toHaveAttribute("aria-activedescendant", charlieItem.id)
  })

  it("disambiguates items sharing a prefix with longer input", async () => {
    const user = userEvent.setup()
    renderTypeaheadMenu()
    const menu = screen.getByRole("menu")
    await user.click(menu)
    await user.keyboard("che")
    const cherryItem = screen.getByText("Cherry").closest("[role='menuitem']")!
    expect(menu).toHaveAttribute("aria-activedescendant", cherryItem.id)
  })
})
