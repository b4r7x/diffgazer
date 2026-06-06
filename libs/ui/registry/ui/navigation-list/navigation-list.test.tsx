import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createRef } from "react"
import { describe, expect, it, vi } from "vitest"
import { testNavigationBehavior } from "../../../../keys/src/testing/navigation-behavior"
import { axe } from "../../../testing/axe"
import { closestElement } from "../../testing/assertions"
import { NavigationList } from "./index"

function renderList(props: Record<string, unknown> = {}) {
  return render(
    <NavigationList aria-label="Test nav" {...props}>
      <NavigationList.Item id="one">
        <NavigationList.Title>One</NavigationList.Title>
      </NavigationList.Item>
      <NavigationList.Item id="two">
        <NavigationList.Title>Two</NavigationList.Title>
      </NavigationList.Item>
      <NavigationList.Item id="three" disabled>
        <NavigationList.Title>Three</NavigationList.Title>
      </NavigationList.Item>
    </NavigationList>
  )
}

describe("NavigationList", () => {
  it("supports direct namespaced item parts with rich item UI", async () => {
    const onSelect = vi.fn()
    render(
      <NavigationList aria-label="Test nav" onSelect={onSelect}>
        <NavigationList.Item id="one">
          <NavigationList.Title>One</NavigationList.Title>
          <NavigationList.Status>Live</NavigationList.Status>
          <NavigationList.Meta>
            <NavigationList.Badge>new</NavigationList.Badge>
          </NavigationList.Meta>
          <NavigationList.Subtitle>First item</NavigationList.Subtitle>
        </NavigationList.Item>
      </NavigationList>,
    )

    await userEvent.click(screen.getByRole("option", { name: /One/ }))

    expect(onSelect).toHaveBeenCalledWith("one")
    expect(screen.getByText("new")).toBeInTheDocument()
  })

  it("passes native root props and composes key handling with list navigation", async () => {
    const ref = createRef<HTMLDivElement>()
    const onClick = vi.fn()
    const onKeyDown = vi.fn()

    renderList({
      ref,
      id: "nav-root",
      "data-testid": "nav-root",
      "data-state": "ready",
      "aria-describedby": "nav-help",
      style: { maxWidth: "12px" },
      defaultHighlighted: "one",
      onClick,
      onKeyDown,
    })

    const list = screen.getByRole("listbox")
    await userEvent.click(list)
    await userEvent.keyboard("{ArrowDown}")

    expect(list).toHaveAttribute("id", "nav-root")
    expect(list).toHaveAttribute("data-state", "ready")
    expect(list).toHaveAttribute("aria-describedby", "nav-help")
    expect(list).toHaveStyle({ maxWidth: "12px" })
    expect(list).toHaveAttribute("tabindex", "0")
    expect(onClick).toHaveBeenCalled()
    expect(onKeyDown).toHaveBeenCalled()
    expect(list).toHaveAttribute("aria-activedescendant", expect.stringContaining("-two"))
    expect(ref.current).toBe(list)
  })

  it("fires onSelect when an item is clicked", async () => {
    const onSelect = vi.fn()
    renderList({ onSelect })
    await userEvent.click(screen.getByText("One"))
    expect(onSelect).toHaveBeenCalledWith("one")
  })

  it("passes item root props and composes item click handlers", async () => {
    const onClick = vi.fn()
    render(
      <NavigationList aria-label="Test nav">
        <NavigationList.Item
          id="one"
          data-state="external"
          style={{ maxWidth: "14px" }}
          onClick={onClick}
        >
          <NavigationList.Title>One</NavigationList.Title>
        </NavigationList.Item>
      </NavigationList>,
    )

    await userEvent.click(screen.getByRole("option", { name: "One" }))

    const item = screen.getByRole("option", { name: "One" })
    expect(onClick).toHaveBeenCalledOnce()
    expect(item).toHaveAttribute("data-state", "selected")
    expect(item).toHaveStyle({ maxWidth: "14px" })
  })

  it("lets item click handlers prevent selection", async () => {
    const onSelect = vi.fn()
    render(
      <NavigationList aria-label="Test nav" onSelect={onSelect}>
        <NavigationList.Item id="one" onClick={(event) => event.preventDefault()}>
          <NavigationList.Title>One</NavigationList.Title>
        </NavigationList.Item>
      </NavigationList>,
    )

    await userEvent.click(screen.getByRole("option", { name: "One" }))

    expect(onSelect).not.toHaveBeenCalled()
    expect(screen.getByRole("option", { name: "One" })).toHaveAttribute("aria-selected", "false")
  })

  it("lets item focus handlers prevent highlight changes", async () => {
    render(
      <NavigationList aria-label="Test nav">
        <NavigationList.Item id="one" onFocus={(event) => event.preventDefault()}>
          <NavigationList.Title>One</NavigationList.Title>
        </NavigationList.Item>
      </NavigationList>,
    )

    screen.getByRole("option", { name: "One" }).focus()

    expect(screen.getByRole("listbox")).not.toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("option", { name: "One" }).id,
    )
  })

  it("composes item mouse down handlers", async () => {
    const onMouseDown = vi.fn()
    render(
      <NavigationList aria-label="Test nav">
        <NavigationList.Item id="one" onMouseDown={onMouseDown}>
          <NavigationList.Title>One</NavigationList.Title>
        </NavigationList.Item>
      </NavigationList>,
    )

    await userEvent.pointer({ target: screen.getByRole("option", { name: "One" }), keys: "[MouseLeft]" })

    expect(onMouseDown).toHaveBeenCalled()
  })

  it("does not fire onSelect when a disabled item is clicked", async () => {
    const onSelect = vi.fn()
    renderList({ onSelect })
    await userEvent.click(screen.getByText("Three"))
    expect(onSelect).not.toHaveBeenCalled()
  })

  it("focuses the listbox after clicking an enabled item so keyboard navigation continues", async () => {
    const user = userEvent.setup()
    renderList()
    const listbox = screen.getByRole("listbox")

    await user.click(screen.getByText("One"))
    expect(listbox).toHaveFocus()

    await user.keyboard("{ArrowDown}")
    expect(listbox).toHaveAttribute(
      "aria-activedescendant",
      expect.stringContaining("-two"),
    )
  })

  it("does not focus or select when a disabled item is clicked", async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    renderList({ onSelect })
    const listbox = screen.getByRole("listbox")

    await user.click(screen.getByText("Three"))

    expect(onSelect).not.toHaveBeenCalled()
    expect(listbox).not.toHaveFocus()
    expect(screen.getByRole("option", { name: "Three" })).toHaveAttribute(
      "aria-selected",
      "false",
    )
  })

  it("does not move keyboard highlight on mouse hover", async () => {
    renderList({ defaultHighlighted: "one" })
    const listbox = screen.getByRole("listbox")
    const oneOption = screen.getByRole("option", { name: "One" })
    const twoOption = screen.getByRole("option", { name: "Two" })

    expect(listbox).toHaveAttribute("aria-activedescendant", oneOption.id)
    await userEvent.hover(twoOption)
    expect(listbox).toHaveAttribute("aria-activedescendant", oneOption.id)
  })

  it("uses a single active visual when selected and highlighted items differ", () => {
    renderList({ selectedId: "one", highlighted: "two", focused: true })

    const selectedOption = screen.getByRole("option", { name: "One" })
    const highlightedOption = screen.getByRole("option", { name: "Two" })

    expect(selectedOption).toHaveAttribute("aria-selected", "true")
    expect(selectedOption).not.toHaveAttribute("data-active")
    expect(highlightedOption).toHaveAttribute("data-active", "true")
  })

  it("uses selected item as active visual when no highlight is set", () => {
    renderList({ selectedId: "one", highlighted: null, focused: true })

    expect(screen.getByRole("option", { name: "One" })).toHaveAttribute("data-active", "true")
  })

  it("does not render disabled item as selected via controlled selectedId", () => {
    renderList({ selectedId: "three", focused: true })

    const disabledOption = screen.getByRole("option", { name: "Three" })
    expect(disabledOption).toHaveAttribute("aria-disabled", "true")
    expect(disabledOption).toHaveAttribute("aria-selected", "false")
    expect(disabledOption).not.toHaveAttribute("data-active", "true")
  })

  it("does not announce disabled item as highlighted via controlled state", () => {
    renderList({ highlighted: "three", focused: true })

    const list = screen.getByRole("listbox")
    const disabledOption = screen.getByRole("option", { name: "Three" })

    expect(list.getAttribute("aria-activedescendant") ?? "").not.toBe(disabledOption.id)
    expect(disabledOption).not.toHaveAttribute("data-active", "true")
  })

  it("fires onSelect in controlled mode without internal state change", async () => {
    const onSelect = vi.fn()
    const { rerender } = render(
      <NavigationList aria-label="Test nav" selectedId="one" onSelect={onSelect}>
        <NavigationList.Item id="one">
          <NavigationList.Title>One</NavigationList.Title>
        </NavigationList.Item>
        <NavigationList.Item id="two">
          <NavigationList.Title>Two</NavigationList.Title>
        </NavigationList.Item>
      </NavigationList>
    )
    await userEvent.click(screen.getByText("Two"))
    expect(onSelect).toHaveBeenCalledWith("two")
    expect(screen.getByRole("option", { name: "One" })).toHaveAttribute(
      "aria-selected",
      "true",
    )

    rerender(
      <NavigationList aria-label="Test nav" selectedId="two" onSelect={onSelect}>
        <NavigationList.Item id="one">
          <NavigationList.Title>One</NavigationList.Title>
        </NavigationList.Item>
        <NavigationList.Item id="two">
          <NavigationList.Title>Two</NavigationList.Title>
        </NavigationList.Item>
      </NavigationList>
    )
    expect(screen.getByRole("option", { name: "Two" })).toHaveAttribute(
      "aria-selected",
      "true",
    )
  })

  it("has no a11y violations", async () => {
    const { container } = renderList()
    expect(await axe(container)).toHaveNoViolations()
  })

  it("renders the selection indicator with a non-zero base opacity so inactive rows keep a visible anchor", () => {
    renderList({ defaultHighlighted: "two", focused: true })

    const oneOption = screen.getByRole("option", { name: "One" })
    // querySelector retained: aria-hidden span has no accessible role; structural assertion is the contract (verifying the visual indicator element exists and has the expected opacity classes)
    const indicator = oneOption.querySelector("span[aria-hidden='true']") as HTMLElement

    expect(indicator).toBeTruthy()
    expect(indicator.className).not.toMatch(/(^|\s)opacity-0(\s|$)/)
    expect(indicator.className).toMatch(/opacity-/)
    expect(indicator.className).toMatch(/group-data-\[active\]:opacity-100/)
  })

  it("moves highlight and activates the highlighted option from the listbox", async () => {
    const onSelect = vi.fn()
    const onEnter = vi.fn()
    renderList({ defaultHighlighted: "one", onSelect, onEnter })
    const listbox = screen.getByRole("listbox")
    listbox.focus()

    await userEvent.keyboard("{ArrowDown}")
    expect(listbox).toHaveAttribute(
      "aria-activedescendant",
      expect.stringContaining("-two"),
    )
    await userEvent.keyboard("{Enter}")

    expect(onSelect).toHaveBeenCalledWith("two")
    expect(onEnter).toHaveBeenCalledWith("two", expect.any(KeyboardEvent))
  })

  it("highlights a matching option with typeahead", async () => {
    const onHighlightChange = vi.fn()
    render(
      <NavigationList aria-label="Test nav" onHighlightChange={onHighlightChange}>
        <NavigationList.Item id="alpha">
          <NavigationList.Title>Alpha</NavigationList.Title>
        </NavigationList.Item>
        <NavigationList.Item id="beta">
          <NavigationList.Title>Beta</NavigationList.Title>
        </NavigationList.Item>
        <NavigationList.Item id="charlie">
          <NavigationList.Title>Charlie</NavigationList.Title>
        </NavigationList.Item>
      </NavigationList>,
    )

    const listbox = screen.getByRole("listbox")
    listbox.focus()
    await userEvent.keyboard("ch")

    const charlieOption = screen.getByRole("option", { name: "Charlie" })
    expect(listbox).toHaveAttribute("aria-activedescendant", charlieOption.id)
    expect(onHighlightChange).toHaveBeenCalledWith("charlie")
  })

  it("skips disabled options and reports non-wrapping boundaries", async () => {
    const onNavigationBoundaryReached = vi.fn()
    render(
      <NavigationList
        aria-label="Test nav"
        defaultHighlighted="one"
        wrap={false}
        onNavigationBoundaryReached={onNavigationBoundaryReached}
      >
        <NavigationList.Item id="one">
          <NavigationList.Title>One</NavigationList.Title>
        </NavigationList.Item>
        <NavigationList.Item id="two" disabled>
          <NavigationList.Title>Two</NavigationList.Title>
        </NavigationList.Item>
        <NavigationList.Item id="three">
          <NavigationList.Title>Three</NavigationList.Title>
        </NavigationList.Item>
      </NavigationList>,
    )

    const listbox = screen.getByRole("listbox")
    const oneOption = screen.getByRole("option", { name: "One" })
    const twoOption = screen.getByRole("option", { name: "Two" })
    const threeOption = screen.getByRole("option", { name: "Three" })

    listbox.focus()
    await userEvent.keyboard("{ArrowDown}")
    expect(listbox).toHaveAttribute("aria-activedescendant", threeOption.id)
    expect(listbox).not.toHaveAttribute("aria-activedescendant", twoOption.id)

    await userEvent.keyboard("{ArrowDown}")
    expect(onNavigationBoundaryReached).toHaveBeenLastCalledWith("next", expect.any(KeyboardEvent), "ArrowDown")
    expect(listbox).toHaveAttribute("aria-activedescendant", threeOption.id)

    await userEvent.keyboard("{ArrowUp}")
    expect(listbox).toHaveAttribute("aria-activedescendant", oneOption.id)

    await userEvent.keyboard("{ArrowUp}")
    expect(onNavigationBoundaryReached).toHaveBeenLastCalledWith("previous", expect.any(KeyboardEvent), "ArrowUp")
    expect(listbox).toHaveAttribute("aria-activedescendant", oneOption.id)
  })

  it("autoFocus focuses the listbox and initializes the first enabled item", async () => {
    render(
      <NavigationList aria-label="Test nav" autoFocus>
        <NavigationList.Item id="one" disabled>
          <NavigationList.Title>One</NavigationList.Title>
        </NavigationList.Item>
        <NavigationList.Item id="two">
          <NavigationList.Title>Two</NavigationList.Title>
        </NavigationList.Item>
      </NavigationList>,
    )

    const listbox = screen.getByRole("listbox")
    const twoOption = screen.getByRole("option", { name: "Two" })

    await waitFor(() => {
      expect(listbox).toHaveFocus()
      expect(listbox).toHaveAttribute("aria-activedescendant", twoOption.id)
    })
  })

  it("only references mounted description elements", () => {
    render(
      <NavigationList aria-label="Test nav">
        <NavigationList.Item id="one">
          <NavigationList.Title>One</NavigationList.Title>
        </NavigationList.Item>
        <NavigationList.Item id="two">
          <NavigationList.Title>Two</NavigationList.Title>
          <NavigationList.Subtitle>Subtitle</NavigationList.Subtitle>
          <NavigationList.Meta>Meta</NavigationList.Meta>
        </NavigationList.Item>
      </NavigationList>
    )

    expect(screen.getByRole("option", { name: "One" })).not.toHaveAttribute("aria-describedby")
    const describedOption = screen.getByRole("option", { name: /Two/ })
    const describedBy = describedOption.getAttribute("aria-describedby")
    expect(describedBy).toContain("-two-desc-meta")
    expect(describedBy).toContain("-two-desc-sub")
  })

  it("keeps item ids unchanged while encoding DOM id references", async () => {
    const id = "release notes/v1.2?"
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(
      <NavigationList aria-label="Test nav" defaultHighlighted={id} onSelect={onSelect}>
        <NavigationList.Item id={id}>
          <NavigationList.Title>Release</NavigationList.Title>
          <NavigationList.Subtitle>Draft</NavigationList.Subtitle>
          <NavigationList.Meta>Updated</NavigationList.Meta>
        </NavigationList.Item>
        <NavigationList.Item id="other">
          <NavigationList.Title>Other</NavigationList.Title>
        </NavigationList.Item>
      </NavigationList>
    )

    const listbox = screen.getByRole("listbox")
    const option = screen.getByRole("option", { name: /Release/ })
    const encodedId = encodeURIComponent(id)

    expect(option).toHaveAttribute("data-value", id)
    expect(option.id).toContain(encodedId)
    expect(listbox).toHaveAttribute("aria-activedescendant", option.id)
    expect(option).toHaveAttribute("aria-labelledby", `${option.id}-label`)
    expect(option.getAttribute("aria-describedby")).toContain(`${option.id}-desc-meta`)
    expect(option.getAttribute("aria-describedby")).toContain(`${option.id}-desc-sub`)

    await user.click(option)
    expect(onSelect).toHaveBeenCalledWith(id)
  })

  it("treats an empty string item id as a valid active descendant value", () => {
    render(
      <NavigationList aria-label="Test nav" defaultHighlighted="">
        <NavigationList.Item id="">
          <NavigationList.Title>Empty id</NavigationList.Title>
        </NavigationList.Item>
        <NavigationList.Item id="other">
          <NavigationList.Title>Other</NavigationList.Title>
        </NavigationList.Item>
      </NavigationList>,
    )

    const listbox = screen.getByRole("listbox")
    const option = closestElement(
      screen.getByText("Empty id"),
      "[role='option']",
      "empty-id option",
    )

    expect(listbox).toHaveAttribute("aria-activedescendant", option.id)
    expect(document.getElementById(option.id)).toBe(option)
  })

})

describe("NavigationList.Progress", () => {
  it("renders with role=progressbar", () => {
    render(
      <NavigationList aria-label="Test nav">
        <NavigationList.Item id="one">
          <NavigationList.Title>One</NavigationList.Title>
          <NavigationList.Meta>
            <NavigationList.Progress value={50} />
          </NavigationList.Meta>
        </NavigationList.Item>
      </NavigationList>,
    )
    expect(screen.getByRole("progressbar")).toBeInTheDocument()
  })

  it("has aria-valuenow matching value prop", () => {
    render(
      <NavigationList aria-label="Test nav">
        <NavigationList.Item id="one">
          <NavigationList.Title>One</NavigationList.Title>
          <NavigationList.Meta>
            <NavigationList.Progress value={73} />
          </NavigationList.Meta>
        </NavigationList.Item>
      </NavigationList>,
    )
    const bar = screen.getByRole("progressbar")
    expect(bar).toHaveAttribute("aria-valuenow", "73")
  })

  it("has aria-valuemin=0 and aria-valuemax=100", () => {
    render(
      <NavigationList aria-label="Test nav">
        <NavigationList.Item id="one">
          <NavigationList.Title>One</NavigationList.Title>
          <NavigationList.Meta>
            <NavigationList.Progress value={50} />
          </NavigationList.Meta>
        </NavigationList.Item>
      </NavigationList>,
    )
    const bar = screen.getByRole("progressbar")
    expect(bar).toHaveAttribute("aria-valuemin", "0")
    expect(bar).toHaveAttribute("aria-valuemax", "100")
  })

  it("block variant renders █ and ░ characters", () => {
    render(
      <NavigationList aria-label="Test nav">
        <NavigationList.Item id="one">
          <NavigationList.Title>One</NavigationList.Title>
          <NavigationList.Meta>
            <NavigationList.Progress value={50} variant="block" width={10} />
          </NavigationList.Meta>
        </NavigationList.Item>
      </NavigationList>,
    )
    const bar = screen.getByRole("progressbar")
    expect(bar.textContent).toContain("█████")
    expect(bar.textContent).toContain("░░░░░")
  })

  it("bar variant renders = and - characters inside [ ]", () => {
    render(
      <NavigationList aria-label="Test nav">
        <NavigationList.Item id="one">
          <NavigationList.Title>One</NavigationList.Title>
          <NavigationList.Meta>
            <NavigationList.Progress value={50} variant="bar" width={10} />
          </NavigationList.Meta>
        </NavigationList.Item>
      </NavigationList>,
    )
    const bar = screen.getByRole("progressbar")
    expect(bar.textContent).toContain("[=====-----]")
  })

  it("shows percentage label by default", () => {
    render(
      <NavigationList aria-label="Test nav">
        <NavigationList.Item id="one">
          <NavigationList.Title>One</NavigationList.Title>
          <NavigationList.Meta>
            <NavigationList.Progress value={50} />
          </NavigationList.Meta>
        </NavigationList.Item>
      </NavigationList>,
    )
    expect(screen.getByRole("progressbar").textContent).toContain("50%")
  })

  it("hides percentage label when showLabel=false", () => {
    render(
      <NavigationList aria-label="Test nav">
        <NavigationList.Item id="one">
          <NavigationList.Title>One</NavigationList.Title>
          <NavigationList.Meta>
            <NavigationList.Progress value={50} showLabel={false} />
          </NavigationList.Meta>
        </NavigationList.Item>
      </NavigationList>,
    )
    expect(screen.getByRole("progressbar").textContent).not.toContain("%")
  })

  it("color auto applies correct color based on value thresholds", () => {
    const { rerender } = render(
      <NavigationList aria-label="Test nav">
        <NavigationList.Item id="one">
          <NavigationList.Title>One</NavigationList.Title>
          <NavigationList.Meta>
            <NavigationList.Progress value={0} />
          </NavigationList.Meta>
        </NavigationList.Item>
      </NavigationList>,
    )
    expect(screen.getByRole("progressbar")).toHaveAttribute("data-color", "muted")

    rerender(
      <NavigationList aria-label="Test nav">
        <NavigationList.Item id="one">
          <NavigationList.Title>One</NavigationList.Title>
          <NavigationList.Meta>
            <NavigationList.Progress value={30} />
          </NavigationList.Meta>
        </NavigationList.Item>
      </NavigationList>,
    )
    expect(screen.getByRole("progressbar")).toHaveAttribute("data-color", "error")

    rerender(
      <NavigationList aria-label="Test nav">
        <NavigationList.Item id="one">
          <NavigationList.Title>One</NavigationList.Title>
          <NavigationList.Meta>
            <NavigationList.Progress value={60} />
          </NavigationList.Meta>
        </NavigationList.Item>
      </NavigationList>,
    )
    expect(screen.getByRole("progressbar")).toHaveAttribute("data-color", "warning")

    rerender(
      <NavigationList aria-label="Test nav">
        <NavigationList.Item id="one">
          <NavigationList.Title>One</NavigationList.Title>
          <NavigationList.Meta>
            <NavigationList.Progress value={90} />
          </NavigationList.Meta>
        </NavigationList.Item>
      </NavigationList>,
    )
    expect(screen.getByRole("progressbar")).toHaveAttribute("data-color", "success")
  })

  it("explicit color prop overrides auto", () => {
    render(
      <NavigationList aria-label="Test nav">
        <NavigationList.Item id="one">
          <NavigationList.Title>One</NavigationList.Title>
          <NavigationList.Meta>
            <NavigationList.Progress value={90} color="error" />
          </NavigationList.Meta>
        </NavigationList.Item>
      </NavigationList>,
    )
    expect(screen.getByRole("progressbar")).toHaveAttribute("data-color", "error")
  })

  it("has no a11y violations with progress bars", async () => {
    const { container } = render(
      <NavigationList aria-label="Test nav">
        <NavigationList.Item id="one">
          <NavigationList.Title>Build</NavigationList.Title>
          <NavigationList.Meta>
            <NavigationList.Progress value={80} />
          </NavigationList.Meta>
        </NavigationList.Item>
        <NavigationList.Item id="two">
          <NavigationList.Title>Test</NavigationList.Title>
          <NavigationList.Meta>
            <NavigationList.Progress value={40} variant="bar" />
          </NavigationList.Meta>
        </NavigationList.Item>
      </NavigationList>,
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe("NavigationList keyboard navigation", () => {
  const ITEM_IDS = ["one", "two", "three"]

  testNavigationBehavior({
    setup: () => {
      const rendered = render(
        <NavigationList aria-label="Test nav" defaultHighlighted="one">
          <NavigationList.Item id="one">
            <NavigationList.Title>One</NavigationList.Title>
          </NavigationList.Item>
          <NavigationList.Item id="two">
            <NavigationList.Title>Two</NavigationList.Title>
          </NavigationList.Item>
          <NavigationList.Item id="three">
            <NavigationList.Title>Three</NavigationList.Title>
          </NavigationList.Item>
        </NavigationList>,
      )
      screen.getByRole("listbox").focus()
      return rendered
    },
    items: ["one", "two", "three"],
    initialActive: 0,
    cases: [
      { key: "{ArrowDown}", expectedActiveIndex: 1, label: "ArrowDown" },
      { key: "{ArrowDown}{ArrowDown}", expectedActiveIndex: 2, label: "ArrowDown ArrowDown" },
      { key: "{ArrowDown}{ArrowDown}{ArrowDown}", expectedActiveIndex: 0, label: "ArrowDown wraps to start" },
      { key: "{ArrowUp}", expectedActiveIndex: 2, label: "ArrowUp wraps to end" },
      { key: "{End}", expectedActiveIndex: 2, label: "End jumps to last" },
      { key: "{Home}", expectedActiveIndex: 0, label: "Home stays at first" },
    ],
    // Use data-value (the stable item id) as the lookup key — the title prepends a decorative
    // indicator glyph that the default accessibleName resolver would concatenate with the label.
    getActiveIndex: (rendered) => {
      // querySelector retained: the lookup key IS the aria-activedescendant attribute presence (the test verifies ARIA wiring directly, not any listbox role match)
      const listbox = rendered.container.querySelector("[aria-activedescendant]")
      const activeId = listbox?.getAttribute("aria-activedescendant")
      if (!activeId) return -1
      const target = (listbox?.ownerDocument ?? document).getElementById(activeId)
      const value = target?.getAttribute("data-value") ?? ""
      return ITEM_IDS.indexOf(value)
    },
  })
})

describe("NavigationListGroup", () => {
  it("section variant renders header with label text", () => {
    render(
      <NavigationList aria-label="Test nav">
        <NavigationList.Group label="Pull Requests">
          <NavigationList.Item id="one">
            <NavigationList.Title>One</NavigationList.Title>
          </NavigationList.Item>
        </NavigationList.Group>
      </NavigationList>,
    )

    expect(screen.getByText("Pull Requests")).toBeInTheDocument()
  })

  it("section header shows count when provided", () => {
    render(
      <NavigationList aria-label="Test nav">
        <NavigationList.Group label="Issues" count={4}>
          <NavigationList.Item id="one">
            <NavigationList.Title>One</NavigationList.Title>
          </NavigationList.Item>
        </NavigationList.Group>
      </NavigationList>,
    )

    expect(screen.getByText("(4)")).toBeInTheDocument()
  })

  it("group renders with role=group and aria-label", () => {
    render(
      <NavigationList aria-label="Test nav">
        <NavigationList.Group label="Section">
          <NavigationList.Item id="one">
            <NavigationList.Title>One</NavigationList.Title>
          </NavigationList.Item>
        </NavigationList.Group>
      </NavigationList>,
    )

    const group = screen.getByRole("group", { name: "Section" })
    expect(group).toBeInTheDocument()
  })

  it("click on header toggles expanded/collapsed", async () => {
    render(
      <NavigationList aria-label="Test nav">
        <NavigationList.Group label="Section">
          <NavigationList.Item id="one">
            <NavigationList.Title>One</NavigationList.Title>
          </NavigationList.Item>
        </NavigationList.Group>
      </NavigationList>,
    )

    const header = screen.getByText("Section")
    expect(screen.getByRole("option", { name: "One" })).toBeInTheDocument()

    await userEvent.click(header)
    expect(screen.queryByRole("option", { name: "One" })).not.toBeInTheDocument()

    await userEvent.click(header)
    expect(screen.getByRole("option", { name: "One" })).toBeInTheDocument()
  })

  it("collapsed group hides children", () => {
    render(
      <NavigationList aria-label="Test nav">
        <NavigationList.Group label="Section" defaultExpanded={false}>
          <NavigationList.Item id="one">
            <NavigationList.Title>One</NavigationList.Title>
          </NavigationList.Item>
        </NavigationList.Group>
      </NavigationList>,
    )

    expect(screen.queryByRole("option", { name: "One" })).not.toBeInTheDocument()
  })

  it("keyboard navigation skips items in a collapsed uncontrolled group", async () => {
    render(
      <NavigationList aria-label="Test nav" defaultHighlighted="before">
        <NavigationList.Item id="before">
          <NavigationList.Title>Before</NavigationList.Title>
        </NavigationList.Item>
        <NavigationList.Group label="Collapsible">
          <NavigationList.Item id="inside">
            <NavigationList.Title>Inside</NavigationList.Title>
          </NavigationList.Item>
        </NavigationList.Group>
        <NavigationList.Item id="after">
          <NavigationList.Title>After</NavigationList.Title>
        </NavigationList.Item>
      </NavigationList>,
    )

    const listbox = screen.getByRole("listbox")
    listbox.focus()

    // Collapse the group by clicking the header
    await userEvent.click(screen.getByText("Collapsible"))
    expect(screen.queryByRole("option", { name: "Inside" })).not.toBeInTheDocument()

    // Arrow down from "before" should skip the collapsed "inside" and land on "after"
    await userEvent.keyboard("{ArrowDown}")
    expect(listbox).toHaveAttribute(
      "aria-activedescendant",
      expect.stringContaining("-after"),
    )
  })

  it("keyboard navigation skips group headers", async () => {
    render(
      <NavigationList aria-label="Test nav" defaultHighlighted="one">
        <NavigationList.Group label="Section A">
          <NavigationList.Item id="one">
            <NavigationList.Title>One</NavigationList.Title>
          </NavigationList.Item>
        </NavigationList.Group>
        <NavigationList.Group label="Section B">
          <NavigationList.Item id="two">
            <NavigationList.Title>Two</NavigationList.Title>
          </NavigationList.Item>
        </NavigationList.Group>
      </NavigationList>,
    )

    const listbox = screen.getByRole("listbox")
    listbox.focus()

    await userEvent.keyboard("{ArrowDown}")
    expect(listbox).toHaveAttribute(
      "aria-activedescendant",
      expect.stringContaining("-two"),
    )
  })

  it("tree variant renders with connectors", () => {
    render(
      <NavigationList aria-label="Test nav">
        <NavigationList.Group label="src" variant="tree">
          <NavigationList.Item id="one">
            <NavigationList.Title>Button.tsx</NavigationList.Title>
          </NavigationList.Item>
          <NavigationList.Item id="two">
            <NavigationList.Title>Input.tsx</NavigationList.Title>
          </NavigationList.Item>
        </NavigationList.Group>
      </NavigationList>,
    )

    expect(screen.getByRole("group", { name: /src/ })).toBeInTheDocument()

    const firstItem = screen.getByRole("option", { name: "Button.tsx" })
    const lastItem = screen.getByRole("option", { name: "Input.tsx" })
    expect(firstItem.textContent).toContain("├──")
    expect(lastItem.textContent).toContain("└──")
  })

  it("nested tree groups increment depth", () => {
    render(
      <NavigationList aria-label="Test nav">
        <NavigationList.Group label="src" variant="tree">
          <NavigationList.Group label="components" variant="tree">
            <NavigationList.Item id="one">
              <NavigationList.Title>Button.tsx</NavigationList.Title>
            </NavigationList.Item>
          </NavigationList.Group>
        </NavigationList.Group>
      </NavigationList>,
    )

    const item = screen.getByRole("option", { name: "Button.tsx" })
    expect(item.textContent).toContain("└──")

    expect(screen.getByRole("group", { name: /components/ })).toBeInTheDocument()
  })

  it("controlled expanded prop works", async () => {
    const onExpandedChange = vi.fn()
    const { rerender } = render(
      <NavigationList aria-label="Test nav">
        <NavigationList.Group label="Section" expanded={true} onExpandedChange={onExpandedChange}>
          <NavigationList.Item id="one">
            <NavigationList.Title>One</NavigationList.Title>
          </NavigationList.Item>
        </NavigationList.Group>
      </NavigationList>,
    )

    expect(screen.getByRole("option", { name: "One" })).toBeInTheDocument()

    await userEvent.click(screen.getByText("Section"))
    expect(onExpandedChange).toHaveBeenCalledWith(false)
    expect(screen.getByRole("option", { name: "One" })).toBeInTheDocument()

    rerender(
      <NavigationList aria-label="Test nav">
        <NavigationList.Group label="Section" expanded={false} onExpandedChange={onExpandedChange}>
          <NavigationList.Item id="one">
            <NavigationList.Title>One</NavigationList.Title>
          </NavigationList.Item>
        </NavigationList.Group>
      </NavigationList>,
    )
    expect(screen.queryByRole("option", { name: "One" })).not.toBeInTheDocument()
  })

  it("has no a11y violations with section groups", async () => {
    const { container } = render(
      <NavigationList aria-label="Test nav">
        <NavigationList.Group label="Section" count={2}>
          <NavigationList.Item id="one">
            <NavigationList.Title>One</NavigationList.Title>
          </NavigationList.Item>
          <NavigationList.Item id="two">
            <NavigationList.Title>Two</NavigationList.Title>
          </NavigationList.Item>
        </NavigationList.Group>
      </NavigationList>,
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  it("has no a11y violations with tree groups", async () => {
    const { container } = render(
      <NavigationList aria-label="Test nav">
        <NavigationList.Group label="src" variant="tree">
          <NavigationList.Item id="one">
            <NavigationList.Title>Button.tsx</NavigationList.Title>
          </NavigationList.Item>
        </NavigationList.Group>
      </NavigationList>,
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  it("ArrowRight expands a collapsed tree group header", async () => {
    render(
      <NavigationList aria-label="Test nav">
        <NavigationList.Group label="src" variant="tree" headerId="src-group" defaultExpanded={false}>
          <NavigationList.Item id="one">
            <NavigationList.Title>Button.tsx</NavigationList.Title>
          </NavigationList.Item>
        </NavigationList.Group>
      </NavigationList>,
    )

    const listbox = screen.getByRole("listbox")
    listbox.focus()

    expect(screen.queryByText("Button.tsx")).not.toBeInTheDocument()

    await userEvent.keyboard("{ArrowDown}")
    expect(listbox).toHaveAttribute("aria-activedescendant", expect.stringContaining("src-group"))

    await userEvent.keyboard("{ArrowRight}")
    expect(screen.getByText("Button.tsx")).toBeInTheDocument()
  })

  it("ArrowLeft collapses an expanded tree group header", async () => {
    render(
      <NavigationList aria-label="Test nav">
        <NavigationList.Group label="src" variant="tree" headerId="src-group" defaultExpanded={true}>
          <NavigationList.Item id="one">
            <NavigationList.Title>Button.tsx</NavigationList.Title>
          </NavigationList.Item>
        </NavigationList.Group>
      </NavigationList>,
    )

    const listbox = screen.getByRole("listbox")
    listbox.focus()

    expect(screen.getByText("Button.tsx")).toBeInTheDocument()

    await userEvent.keyboard("{ArrowDown}")
    expect(listbox).toHaveAttribute("aria-activedescendant", expect.stringContaining("src-group"))

    await userEvent.keyboard("{ArrowLeft}")
    expect(screen.queryByText("Button.tsx")).not.toBeInTheDocument()
  })

  it("ArrowLeft on a non-group item does nothing special", async () => {
    render(
      <NavigationList aria-label="Test nav" defaultHighlighted="one">
        <NavigationList.Group label="src" variant="tree" headerId="src-group">
          <NavigationList.Item id="one">
            <NavigationList.Title>Button.tsx</NavigationList.Title>
          </NavigationList.Item>
        </NavigationList.Group>
      </NavigationList>,
    )

    const listbox = screen.getByRole("listbox")
    listbox.focus()

    expect(listbox).toHaveAttribute("aria-activedescendant", expect.stringContaining("-one"))

    await userEvent.keyboard("{ArrowLeft}")
    expect(listbox).toHaveAttribute("aria-activedescendant", expect.stringContaining("-one"))
    expect(screen.getByText("Button.tsx")).toBeInTheDocument()
  })

  it("Enter toggles tree group header expansion", async () => {
    render(
      <NavigationList aria-label="Test nav">
        <NavigationList.Group label="src" variant="tree" headerId="src-group" defaultExpanded={true}>
          <NavigationList.Item id="one">
            <NavigationList.Title>Button.tsx</NavigationList.Title>
          </NavigationList.Item>
        </NavigationList.Group>
      </NavigationList>,
    )

    const listbox = screen.getByRole("listbox")
    listbox.focus()

    await userEvent.keyboard("{ArrowDown}")
    expect(listbox).toHaveAttribute("aria-activedescendant", expect.stringContaining("src-group"))

    await userEvent.keyboard("{Enter}")
    expect(screen.queryByText("Button.tsx")).not.toBeInTheDocument()
  })

  it("tree group header does not fire onSelect", async () => {
    const onSelect = vi.fn()
    render(
      <NavigationList aria-label="Test nav" onSelect={onSelect}>
        <NavigationList.Group label="src" variant="tree" headerId="src-group">
          <NavigationList.Item id="one">
            <NavigationList.Title>Button.tsx</NavigationList.Title>
          </NavigationList.Item>
        </NavigationList.Group>
      </NavigationList>,
    )

    const listbox = screen.getByRole("listbox")
    listbox.focus()

    await userEvent.keyboard("{ArrowDown}")
    await userEvent.keyboard("{Enter}")

    expect(onSelect).not.toHaveBeenCalled()
  })

  it("tree group header is navigable with ArrowDown/ArrowUp", async () => {
    render(
      <NavigationList aria-label="Test nav">
        <NavigationList.Item id="before">
          <NavigationList.Title>Before</NavigationList.Title>
        </NavigationList.Item>
        <NavigationList.Group label="src" variant="tree" headerId="src-group">
          <NavigationList.Item id="one">
            <NavigationList.Title>Button.tsx</NavigationList.Title>
          </NavigationList.Item>
        </NavigationList.Group>
      </NavigationList>,
    )

    const listbox = screen.getByRole("listbox")
    listbox.focus()

    await userEvent.keyboard("{ArrowDown}")
    expect(listbox).toHaveAttribute("aria-activedescendant", expect.stringContaining("-before"))

    await userEvent.keyboard("{ArrowDown}")
    expect(listbox).toHaveAttribute("aria-activedescendant", expect.stringContaining("src-group"))

    await userEvent.keyboard("{ArrowDown}")
    expect(listbox).toHaveAttribute("aria-activedescendant", expect.stringContaining("-one"))
  })
})

describe("NavigationList indicator variants", () => {
  function renderWithIndicator(indicator?: "bar" | "bar-thick" | "arrow" | "bracket") {
    return render(
      <NavigationList
        aria-label="Test nav"
        selectedId="one"
        focused
        {...(indicator ? { indicator } : {})}
      >
        <NavigationList.Item id="one">
          <NavigationList.Title>One</NavigationList.Title>
        </NavigationList.Item>
        <NavigationList.Item id="two">
          <NavigationList.Title>Two</NavigationList.Title>
        </NavigationList.Item>
      </NavigationList>,
    )
  }

  it("defaults to bar indicator", () => {
    const { container } = renderWithIndicator()
    // querySelector retained: data-indicator is a structural test hook on the indicator slot div, not an accessible element
    const slot = container.querySelector("[data-indicator]") as HTMLElement
    expect(slot).toBeTruthy()
    expect(slot.getAttribute("data-indicator")).toBe("bar")
  })

  it("renders bar-thick indicator with wider slot", () => {
    const { container } = renderWithIndicator("bar-thick")
    // querySelector retained: data-indicator is a structural test hook on the indicator slot div
    const slots = container.querySelectorAll("[data-indicator='bar-thick']")
    expect(slots.length).toBeGreaterThan(0)
  })

  it("renders > glyph prefix on active item for arrow indicator", () => {
    renderWithIndicator("arrow")
    const activeItem = screen.getByRole("option", { name: "One" })
    expect(activeItem.textContent).toContain(">")

    const inactiveItem = screen.getByRole("option", { name: "Two" })
    expect(inactiveItem.textContent).toContain(">")
  })

  it("renders [ ] wrapping on items for bracket indicator", () => {
    renderWithIndicator("bracket")
    const activeItem = screen.getByRole("option", { name: "One" })
    expect(activeItem.textContent).toContain("[")
    expect(activeItem.textContent).toContain("]")
  })

  it("does not affect keyboard navigation when indicator changes", async () => {
    const onSelect = vi.fn()
    render(
      <NavigationList
        aria-label="Test nav"
        indicator="arrow"
        defaultHighlighted="one"
        onSelect={onSelect}
      >
        <NavigationList.Item id="one">
          <NavigationList.Title>One</NavigationList.Title>
        </NavigationList.Item>
        <NavigationList.Item id="two">
          <NavigationList.Title>Two</NavigationList.Title>
        </NavigationList.Item>
      </NavigationList>,
    )

    const listbox = screen.getByRole("listbox")
    listbox.focus()
    await userEvent.keyboard("{ArrowDown}")
    await userEvent.keyboard("{Enter}")

    expect(onSelect).toHaveBeenCalledWith("two")
  })

  it("has no a11y violations with bar-thick indicator", async () => {
    const { container } = renderWithIndicator("bar-thick")
    expect(await axe(container)).toHaveNoViolations()
  })

  it("has no a11y violations with arrow indicator", async () => {
    const { container } = renderWithIndicator("arrow")
    expect(await axe(container)).toHaveNoViolations()
  })

  it("has no a11y violations with bracket indicator", async () => {
    const { container } = renderWithIndicator("bracket")
    expect(await axe(container)).toHaveNoViolations()
  })
})
