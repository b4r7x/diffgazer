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
