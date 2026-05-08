import { createRef } from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { axe } from "../../../testing/utils.js"
import { describe, it, expect, vi } from "vitest"
import { NavigationList } from "./index.js"

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
      defaultHighlightedId: "one",
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
    renderList({ defaultHighlightedId: "one" })
    const listbox = screen.getByRole("listbox")
    const oneOption = screen.getByRole("option", { name: "One" })
    const twoOption = screen.getByRole("option", { name: "Two" })

    expect(listbox).toHaveAttribute("aria-activedescendant", oneOption.id)
    await userEvent.hover(twoOption)
    expect(listbox).toHaveAttribute("aria-activedescendant", oneOption.id)
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

  it("moves highlight with ArrowDown and ArrowUp", async () => {
    renderList({ defaultHighlightedId: "one" })
    const listbox = screen.getByRole("listbox")
    listbox.focus()
    await userEvent.keyboard("{ArrowDown}")
    expect(listbox).toHaveAttribute(
      "aria-activedescendant",
      expect.stringContaining("-two"),
    )
    await userEvent.keyboard("{ArrowUp}")
    expect(listbox).toHaveAttribute(
      "aria-activedescendant",
      expect.stringContaining("-one"),
    )
  })

  it("activates highlighted item with Enter", async () => {
    const onSelect = vi.fn()
    renderList({ defaultHighlightedId: "one", onSelect })
    const listbox = screen.getByRole("listbox")
    listbox.focus()
    await userEvent.keyboard("{Enter}")
    expect(onSelect).toHaveBeenCalledWith("one")
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
      <NavigationList aria-label="Test nav" defaultHighlightedId={id} onSelect={onSelect}>
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
      <NavigationList aria-label="Test nav" defaultHighlightedId="">
        <NavigationList.Item id="">
          <NavigationList.Title>Empty id</NavigationList.Title>
        </NavigationList.Item>
        <NavigationList.Item id="other">
          <NavigationList.Title>Other</NavigationList.Title>
        </NavigationList.Item>
      </NavigationList>,
    )

    const listbox = screen.getByRole("listbox")
    const option = screen.getByText("Empty id").closest("[role='option']")!

    expect(listbox).toHaveAttribute("aria-activedescendant", option.id)
    expect(document.getElementById(option.id)).toBe(option)
  })

})

describe("NavigationList typeahead", () => {
  function renderTypeaheadList() {
    return render(
      <NavigationList aria-label="Test list">
        <NavigationList.Item id="alpha">
          <NavigationList.Title>Alpha</NavigationList.Title>
        </NavigationList.Item>
        <NavigationList.Item id="beta">
          <NavigationList.Title>Beta</NavigationList.Title>
        </NavigationList.Item>
        <NavigationList.Item id="charlie">
          <NavigationList.Title>Charlie</NavigationList.Title>
        </NavigationList.Item>
      </NavigationList>
    )
  }

  it("highlights item matching typed character", async () => {
    const user = userEvent.setup()
    renderTypeaheadList()
    const list = screen.getByRole("listbox")
    await user.click(list)
    await user.keyboard("b")
    const betaOption = screen.getByRole("option", { name: "Beta" })
    expect(list).toHaveAttribute("aria-activedescendant", betaOption.id)
  })

  it("accumulates characters for multi-char typeahead", async () => {
    const user = userEvent.setup()
    renderTypeaheadList()
    const list = screen.getByRole("listbox")
    await user.click(list)
    await user.keyboard("ch")
    const charlieOption = screen.getByRole("option", { name: "Charlie" })
    expect(list).toHaveAttribute("aria-activedescendant", charlieOption.id)
  })
})
