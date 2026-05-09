import { createRef } from "react"
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
  it("supports direct namespaced items with custom item UI", async () => {
    const onSelect = vi.fn()
    render(
      <Menu aria-label="Test menu" onSelect={onSelect}>
        <Menu.Item id="one">
          <span>One</span>
        </Menu.Item>
        <Menu.Divider />
        <Menu.Item id="two" value="ready">
          <span>Two</span>
        </Menu.Item>
      </Menu>,
    )

    await userEvent.click(screen.getByText("Two"))

    expect(onSelect).toHaveBeenCalledWith("two")
    expect(screen.getByRole("separator")).toBeInTheDocument()
  })

  it("passes native root props and composes key handling with menu navigation", async () => {
    const ref = createRef<HTMLDivElement>()
    const onClick = vi.fn()
    const onKeyDown = vi.fn()

    renderMenu({
      ref,
      id: "menu-root",
      "data-testid": "menu-root",
      "data-state": "ready",
      "aria-describedby": "menu-help",
      style: { maxWidth: "12px" },
      defaultHighlightedId: "one",
      onClick,
      onKeyDown,
    })

    const menu = screen.getByRole("menu")
    await userEvent.click(menu)
    await userEvent.keyboard("{ArrowDown}")

    expect(menu).toHaveAttribute("id", "menu-root")
    expect(menu).toHaveAttribute("data-state", "ready")
    expect(menu).toHaveAttribute("aria-describedby", "menu-help")
    expect(menu).toHaveStyle({ maxWidth: "12px" })
    expect(menu).toHaveAttribute("tabindex", "0")
    expect(onClick).toHaveBeenCalled()
    expect(onKeyDown).toHaveBeenCalled()
    expect(menu).toHaveAttribute("aria-activedescendant", expect.stringContaining("-two"))
    expect(ref.current).toBe(menu)
  })

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

  it("does not move keyboard highlight on mouse hover", async () => {
    renderMenu({ defaultHighlightedId: "one" })
    const menu = screen.getByRole("menu")
    const oneItem = screen.getByText("One").closest("[role='menuitem']")!
    const twoItem = screen.getByText("Two").closest("[role='menuitem']")!

    expect(menu).toHaveAttribute("aria-activedescendant", oneItem.id)
    await userEvent.hover(twoItem)
    expect(menu).toHaveAttribute("aria-activedescendant", oneItem.id)
  })

  it("marks highlighted and selected items active with data-active", () => {
    renderMenu({ defaultSelectedId: "two" })
    const oneItem = screen.getByText("One").closest("[role='menuitemradio']")!
    const twoItem = screen.getByText("Two").closest("[role='menuitemradio']")!

    expect(twoItem).toHaveAttribute("data-active", "true")
    expect(twoItem).toHaveAttribute("aria-checked", "true")
    expect(oneItem).not.toHaveAttribute("data-active")
  })

  it("does not keep selected state for plain command menus", async () => {
    renderMenu({ defaultHighlightedId: "one" })
    const menu = screen.getByRole("menu")
    const oneItem = screen.getByText("One").closest("[role='menuitem']")!
    const twoItem = screen.getByText("Two").closest("[role='menuitem']")!

    menu.focus()
    await userEvent.keyboard("{Enter}{ArrowDown}")

    expect(oneItem).not.toHaveAttribute("data-active")
    expect(twoItem).toHaveAttribute("data-active", "true")
    expect(menu).toHaveAttribute("aria-activedescendant", twoItem.id)
  })

  it("marks selected hub items and renders their values", () => {
    const { rerender } = render(
      <Menu aria-label="Hub menu" variant="hub" defaultSelectedId="provider">
        <Menu.Item id="provider" value="ready" valueVariant="success-badge">Provider</Menu.Item>
        <Menu.Item id="delete" variant="danger" value="armed">Delete</Menu.Item>
      </Menu>
    )

    const providerItem = screen.getByText("Provider").closest("[role='menuitemradio']")!
    expect(providerItem).toHaveAttribute("aria-checked", "true")
    expect(screen.getByText("ready")).toBeInTheDocument()

    rerender(
      <Menu aria-label="Hub menu" variant="hub" highlightedId="delete">
        <Menu.Item id="provider" value="ready" valueVariant="success-badge">Provider</Menu.Item>
        <Menu.Item id="delete" variant="danger" value="armed">Delete</Menu.Item>
      </Menu>
    )
    expect(screen.getByText("armed")).toBeInTheDocument()
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

  it("calls onClose on Tab without preventing default", async () => {
    const onClose = vi.fn()
    const onKeyDown = vi.fn()
    renderMenu({ onClose, onKeyDown, defaultHighlightedId: "one" })
    const menu = screen.getByRole("menu")
    menu.focus()

    await userEvent.keyboard("{Tab}")

    expect(onClose).toHaveBeenCalled()
    expect(onKeyDown).toHaveBeenCalled()
    expect(onKeyDown.mock.calls[0][0].defaultPrevented).toBe(false)
  })

  it("focuses the container on mount when autoFocus is true", async () => {
    renderMenu({ autoFocus: true, defaultHighlightedId: "one" })
    const menu = screen.getByRole("menu")
    await waitFor(() => {
      expect(menu).toHaveFocus()
    })
  })

  it("autoFocus initializes the first enabled item when no item is active", async () => {
    render(
      <Menu aria-label="Test menu" autoFocus>
        <Menu.Item id="one" disabled>One</Menu.Item>
        <Menu.Item id="two">Two</Menu.Item>
      </Menu>
    )
    const menu = screen.getByRole("menu")
    const twoItem = screen.getByText("Two").closest("[role='menuitem']")!

    await waitFor(() => {
      expect(menu).toHaveAttribute("aria-activedescendant", twoItem.id)
    })
  })

  it("autoFocus preserves an empty string highlighted id", async () => {
    render(
      <Menu aria-label="Test menu" autoFocus defaultHighlightedId="">
        <Menu.Item id="one">One</Menu.Item>
        <Menu.Item id="">Empty id</Menu.Item>
      </Menu>,
    )

    const menu = screen.getByRole("menu")
    const emptyItem = screen.getByText("Empty id").closest("[role='menuitem']")!

    await waitFor(() => {
      expect(menu).toHaveFocus()
      expect(menu).toHaveAttribute("aria-activedescendant", emptyItem.id)
    })
  })

  it("uses encoded item ids for active descendant references", () => {
    const id = "release notes/v1.2?"
    render(
      <Menu aria-label="Test menu" defaultHighlightedId={id}>
        <Menu.Item id={id}>Release</Menu.Item>
        <Menu.Item id="other">Other</Menu.Item>
      </Menu>,
    )

    const menu = screen.getByRole("menu")
    const item = screen.getByText("Release").closest("[role='menuitem']")!

    expect(item.id).toContain(encodeURIComponent(id))
    expect(menu).toHaveAttribute("aria-activedescendant", item.id)
    expect(document.getElementById(menu.getAttribute("aria-activedescendant")!)).toBe(item)
  })

  it("treats an empty string item id as a valid active descendant value", () => {
    render(
      <Menu aria-label="Test menu" defaultHighlightedId="">
        <Menu.Item id="">Empty id</Menu.Item>
        <Menu.Item id="other">Other</Menu.Item>
      </Menu>,
    )

    const menu = screen.getByRole("menu")
    const item = screen.getByText("Empty id").closest("[role='menuitem']")!

    expect(menu).toHaveAttribute("aria-activedescendant", item.id)
    expect(document.getElementById(item.id)).toBe(item)
  })

  it("renders falsy hub item values that are explicit React nodes", () => {
    render(
      <Menu aria-label="Test menu" variant="hub">
        <Menu.Item id="zero" value={0}>Zero</Menu.Item>
        <Menu.Item id="empty" value="">Empty</Menu.Item>
      </Menu>,
    )

    expect(screen.getByText("0")).toBeInTheDocument()
    expect(screen.getByText("Empty").closest("[role='menuitem']")).toHaveTextContent("Empty")
  })

  it("renders a divider as a separator", () => {
    render(
      <Menu aria-label="Test menu">
        <Menu.Item id="one">One</Menu.Item>
        <Menu.Divider />
        <Menu.Item id="two">Two</Menu.Item>
      </Menu>
    )
    expect(screen.getByRole("separator")).toHaveAttribute("aria-orientation", "horizontal")
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
