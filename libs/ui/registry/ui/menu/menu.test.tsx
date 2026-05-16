import { createRef } from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { testNavigationBehavior } from "../../../../keys/src/testing/navigation-behavior.js"
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

function getMenuItem(name: string | RegExp) {
  return screen.getByRole("menuitem", { name })
}

function getMenuItemRadio(name: string | RegExp) {
  return screen.getByRole("menuitemradio", { name })
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

    await userEvent.click(getMenuItem("Two"))

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
      "data-state": "ready",
      "aria-describedby": "menu-help",
      style: { maxWidth: "12px" },
      defaultHighlighted: "one",
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
    await userEvent.click(getMenuItem("One"))
    expect(onSelect).toHaveBeenCalledWith("one")
  })

  it("does not fire onSelect for disabled items and marks them aria-disabled", async () => {
    const onSelect = vi.fn()
    renderMenu({ onSelect })
    const disabledItem = getMenuItem("Three")
    expect(disabledItem).toHaveAttribute("aria-disabled", "true")
    await userEvent.click(disabledItem)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it("does not move keyboard highlight on mouse hover", async () => {
    renderMenu({ defaultHighlighted: "one" })
    const menu = screen.getByRole("menu")
    const oneItem = getMenuItem("One")
    const twoItem = getMenuItem("Two")

    expect(menu).toHaveAttribute("aria-activedescendant", oneItem.id)
    await userEvent.hover(twoItem)
    expect(menu).toHaveAttribute("aria-activedescendant", oneItem.id)
  })

  it("marks highlighted and selected items active with data-active", () => {
    renderMenu({ defaultSelectedId: "two" })
    const oneItem = getMenuItemRadio("One")
    const twoItem = getMenuItemRadio("Two")

    expect(twoItem).toHaveAttribute("data-active", "true")
    expect(twoItem).toHaveAttribute("aria-checked", "true")
    expect(oneItem).not.toHaveAttribute("data-active")
  })

  it("does not keep selected state for plain command menus", async () => {
    renderMenu({ defaultHighlighted: "one" })
    const menu = screen.getByRole("menu")
    const oneItem = getMenuItem("One")
    const twoItem = getMenuItem("Two")

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

    const providerItem = getMenuItemRadio(/provider/i)
    expect(providerItem).toHaveAttribute("aria-checked", "true")
    expect(screen.getByText("ready")).toBeInTheDocument()

    rerender(
      <Menu aria-label="Hub menu" variant="hub" highlighted="delete">
        <Menu.Item id="provider" value="ready" valueVariant="success-badge">Provider</Menu.Item>
        <Menu.Item id="delete" variant="danger" value="armed">Delete</Menu.Item>
      </Menu>
    )
    expect(screen.getByText("armed")).toBeInTheDocument()
  })

  it("selects defaultSelectedId initially", () => {
    renderMenu({ defaultSelectedId: "two" })
    const item = getMenuItemRadio("Two")
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
    await userEvent.click(getMenuItemRadio("Two"))
    expect(onSelect).toHaveBeenCalledWith("two")
    expect(getMenuItemRadio("One")).toHaveAttribute(
      "aria-checked",
      "true",
    )

    rerender(
      <Menu aria-label="Test menu" selectedId="two" onSelect={onSelect}>
        <Menu.Item id="one">One</Menu.Item>
        <Menu.Item id="two">Two</Menu.Item>
      </Menu>
    )
    expect(getMenuItemRadio("Two")).toHaveAttribute(
      "aria-checked",
      "true",
    )
  })

  it("has no a11y violations", async () => {
    const { container } = renderMenu()
    expect(await axe(container)).toHaveNoViolations()
  })

  it("moves highlight with ArrowDown and ArrowUp", async () => {
    renderMenu({ defaultHighlighted: "one" })
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
    renderMenu({ defaultHighlighted: "one", onSelect })
    const listbox = screen.getByRole("menu")
    listbox.focus()
    await userEvent.keyboard("{Enter}")
    expect(onSelect).toHaveBeenCalledWith("one")
  })

  it("calls onClose when Escape is pressed", async () => {
    const onClose = vi.fn()
    renderMenu({ onClose, defaultHighlighted: "one" })
    const menu = screen.getByRole("menu")
    menu.focus()
    await userEvent.keyboard("{Escape}")
    expect(onClose).toHaveBeenCalled()
  })

  it("calls onClose on Tab and lets focus leave the menu", async () => {
    const onClose = vi.fn()
    const onKeyDown = vi.fn()
    render(
      <>
        <Menu aria-label="Test menu" onClose={onClose} onKeyDown={onKeyDown} defaultHighlighted="one">
          <Menu.Item id="one">One</Menu.Item>
          <Menu.Item id="two">Two</Menu.Item>
          <Menu.Item id="three" disabled>Three</Menu.Item>
        </Menu>
        <button type="button">After</button>
      </>
    )
    const menu = screen.getByRole("menu")
    menu.focus()

    await userEvent.keyboard("{Tab}")

    expect(onClose).toHaveBeenCalled()
    expect(onKeyDown).toHaveBeenCalled()
    expect(menu).not.toHaveFocus()
    expect(screen.getByRole("button", { name: "After" })).toHaveFocus()
  })

  it("focuses the container on mount when autoFocus is true", async () => {
    renderMenu({ autoFocus: true, defaultHighlighted: "one" })
    const menu = screen.getByRole("menu")
    await waitFor(() => {
      expect(menu).toHaveFocus()
    })
  })

  it("autoFocus initializes the first menu item, including disabled items", async () => {
    render(
      <Menu aria-label="Test menu" autoFocus>
        <Menu.Item id="one" disabled>One</Menu.Item>
        <Menu.Item id="two">Two</Menu.Item>
      </Menu>
    )
    const menu = screen.getByRole("menu")
    const oneItem = getMenuItem("One")

    await waitFor(() => {
      expect(menu).toHaveAttribute("aria-activedescendant", oneItem.id)
    })
  })

  it("autoFocus preserves an empty string highlighted id", async () => {
    render(
      <Menu aria-label="Test menu" autoFocus defaultHighlighted="">
        <Menu.Item id="one">One</Menu.Item>
        <Menu.Item id="">Empty id</Menu.Item>
      </Menu>,
    )

    const menu = screen.getByRole("menu")
    const emptyItem = getMenuItem("Empty id")

    await waitFor(() => {
      expect(menu).toHaveFocus()
      expect(menu).toHaveAttribute("aria-activedescendant", emptyItem.id)
    })
  })

  it("uses encoded item ids for active descendant references", () => {
    const id = "release notes/v1.2?"
    render(
      <Menu aria-label="Test menu" defaultHighlighted={id}>
        <Menu.Item id={id}>Release</Menu.Item>
        <Menu.Item id="other">Other</Menu.Item>
      </Menu>,
    )

    const menu = screen.getByRole("menu")
    const item = getMenuItem("Release")

    expect(item.id).toContain(encodeURIComponent(id))
    expect(menu).toHaveAttribute("aria-activedescendant", item.id)
    expect(document.getElementById(menu.getAttribute("aria-activedescendant")!)).toBe(item)
  })

  it("treats an empty string item id as a valid active descendant value", () => {
    render(
      <Menu aria-label="Test menu" defaultHighlighted="">
        <Menu.Item id="">Empty id</Menu.Item>
        <Menu.Item id="other">Other</Menu.Item>
      </Menu>,
    )

    const menu = screen.getByRole("menu")
    const item = getMenuItem("Empty id")

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
    expect(getMenuItem("Empty")).toHaveTextContent("Empty")
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

  it("does not render disabled item as selected when supplied via controlled selectedId", () => {
    render(
      <Menu aria-label="Test menu" selectedId="two">
        <Menu.Item id="one">One</Menu.Item>
        <Menu.Item id="two" disabled>Two</Menu.Item>
      </Menu>,
    )
    const disabledItem = getMenuItemRadio("Two")
    expect(disabledItem).toHaveAttribute("aria-disabled", "true")
    expect(disabledItem).not.toHaveAttribute("aria-checked", "true")
    expect(disabledItem).not.toHaveAttribute("data-active", "true")
  })

  it("disabled highlighted menu item is the active descendant with focus indication but not selected", () => {
    // APG menu pattern: disabled menu items remain focusable (active descendant)
    // but should not appear visually active or be announced as selected.
    render(
      <Menu aria-label="Test menu" highlighted="two">
        <Menu.Item id="one">One</Menu.Item>
        <Menu.Item id="two" disabled>Two</Menu.Item>
      </Menu>,
    )
    const menu = screen.getByRole("menu")
    const disabledItem = getMenuItem("Two")

    expect(menu).toHaveAttribute("aria-activedescendant", disabledItem.id)
    expect(disabledItem).not.toHaveAttribute("data-active", "true")
    expect(disabledItem).toHaveAttribute("data-focus", "true")
    expect(disabledItem).not.toHaveAttribute("aria-checked", "true")
  })

  it("APG: ArrowDown moves through disabled menu items but Enter does not activate them", async () => {
    const onSelect = vi.fn()
    render(
      <Menu aria-label="Test menu" defaultHighlighted="one" onSelect={onSelect}>
        <Menu.Item id="one">One</Menu.Item>
        <Menu.Item id="two" disabled>Two</Menu.Item>
        <Menu.Item id="three">Three</Menu.Item>
      </Menu>,
    )
    const menu = screen.getByRole("menu")
    const twoItem = getMenuItem("Two")
    const threeItem = getMenuItem("Three")

    menu.focus()
    await userEvent.keyboard("{ArrowDown}")
    expect(menu).toHaveAttribute("aria-activedescendant", twoItem.id)

    await userEvent.keyboard("{Enter}")
    expect(onSelect).not.toHaveBeenCalled()

    await userEvent.keyboard("{ArrowDown}")
    expect(menu).toHaveAttribute("aria-activedescendant", threeItem.id)

    await userEvent.keyboard("{Enter}")
    expect(onSelect).toHaveBeenCalledWith("three")
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
    const betaItem = getMenuItem("Beta")
    expect(menu).toHaveAttribute("aria-activedescendant", betaItem.id)
  })

  it("accumulates characters for multi-char typeahead", async () => {
    const user = userEvent.setup()
    renderTypeaheadMenu()
    const menu = screen.getByRole("menu")
    await user.click(menu)
    await user.keyboard("ch")
    const charlieItem = getMenuItem("Charlie")
    expect(menu).toHaveAttribute("aria-activedescendant", charlieItem.id)
  })

  it("disambiguates items sharing a prefix with longer input", async () => {
    const user = userEvent.setup()
    renderTypeaheadMenu()
    const menu = screen.getByRole("menu")
    await user.click(menu)
    await user.keyboard("che")
    const cherryItem = getMenuItem("Cherry")
    expect(menu).toHaveAttribute("aria-activedescendant", cherryItem.id)
  })
})

describe("Menu keyboard navigation", () => {
  const ITEM_IDS = ["one", "two", "three"] as const

  testNavigationBehavior({
    setup: () => {
      const rendered = render(
        <Menu aria-label="Test menu" defaultHighlighted="one">
          <Menu.Item id="one">One</Menu.Item>
          <Menu.Item id="two">Two</Menu.Item>
          <Menu.Item id="three">Three</Menu.Item>
        </Menu>,
      )
      screen.getByRole("menu").focus()
      return rendered
    },
    items: ["one", "two", "three"],
    initialActive: 0,
    cases: [
      { key: "{ArrowDown}", expectedActiveIndex: 1, label: "ArrowDown" },
      { key: "{ArrowDown}{ArrowDown}", expectedActiveIndex: 2, label: "ArrowDown twice" },
      { key: "{ArrowDown}{ArrowDown}{ArrowDown}", expectedActiveIndex: 0, label: "ArrowDown wraps" },
      { key: "{ArrowUp}", expectedActiveIndex: 2, label: "ArrowUp wraps to end" },
      { key: "{End}", expectedActiveIndex: 2, label: "End jumps to last" },
      { key: "{Home}", expectedActiveIndex: 0, label: "Home stays at first" },
    ],
    // Menu items render a decorative MenuItemIndicator span; resolve by data-value instead.
    getActiveIndex: (rendered) => {
      // querySelector retained: the lookup key IS the aria-activedescendant attribute presence (the test verifies ARIA wiring directly, not any menu role match)
      const host = rendered.container.querySelector("[aria-activedescendant]")
      const activeId = host?.getAttribute("aria-activedescendant")
      if (!activeId) return -1
      const target = (host?.ownerDocument ?? document).getElementById(activeId)
      const value = target?.getAttribute("data-value") ?? ""
      return ITEM_IDS.findIndex((id) => id === value)
    },
  })
})
