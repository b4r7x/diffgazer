import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { axe } from "../../../testing/utils.js"
import { describe, it, expect, vi } from "vitest"
import { Tabs } from "./index.js"
import { useState } from "react"

function renderTabs(props: Record<string, unknown> = {}) {
  return render(
    <Tabs defaultValue="one" {...props}>
      <Tabs.List>
        <Tabs.Trigger value="one">One</Tabs.Trigger>
        <Tabs.Trigger value="two">Two</Tabs.Trigger>
        <Tabs.Trigger value="three">Three</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="one">Content one</Tabs.Content>
      <Tabs.Content value="two">Content two</Tabs.Content>
      <Tabs.Content value="three">Content three</Tabs.Content>
    </Tabs>
  )
}

describe("Tabs", () => {
  it("selects a tab on click", async () => {
    renderTabs()
    await userEvent.click(screen.getByRole("tab", { name: "Two" }))
    expect(screen.getByRole("tab", { name: "Two" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByRole("tab", { name: "One" })).toHaveAttribute("aria-selected", "false")
    expect(screen.getByText("Content two")).not.toHaveAttribute("hidden")
    expect(screen.getByText("Content one")).toHaveAttribute("hidden")
  })

  it("does not select a disabled tab on click", async () => {
    render(
      <Tabs defaultValue="one">
        <Tabs.List>
          <Tabs.Trigger value="one">One</Tabs.Trigger>
          <Tabs.Trigger value="two" disabled>Two</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="one">Content one</Tabs.Content>
        <Tabs.Content value="two">Content two</Tabs.Content>
      </Tabs>
    )
    await userEvent.click(screen.getByRole("tab", { name: "Two" }))
    expect(screen.getByRole("tab", { name: "One" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByRole("tab", { name: "Two" })).toHaveAttribute("aria-selected", "false")
  })

  it("respects controlled value and fires onValueChange", async () => {
    const onValueChange = vi.fn()
    const { rerender } = render(
      <Tabs value="one" onValueChange={onValueChange}>
        <Tabs.List>
          <Tabs.Trigger value="one">One</Tabs.Trigger>
          <Tabs.Trigger value="two">Two</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="one">Content one</Tabs.Content>
        <Tabs.Content value="two">Content two</Tabs.Content>
      </Tabs>
    )
    await userEvent.click(screen.getByRole("tab", { name: "Two" }))
    expect(onValueChange).toHaveBeenCalledWith("two")
    expect(screen.getByRole("tab", { name: "One" })).toHaveAttribute("aria-selected", "true")

    rerender(
      <Tabs value="two" onValueChange={onValueChange}>
        <Tabs.List>
          <Tabs.Trigger value="one">One</Tabs.Trigger>
          <Tabs.Trigger value="two">Two</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="one">Content one</Tabs.Content>
        <Tabs.Content value="two">Content two</Tabs.Content>
      </Tabs>
    )
    expect(screen.getByRole("tab", { name: "Two" })).toHaveAttribute("aria-selected", "true")
  })

  it("has no a11y violations", async () => {
    const { container } = renderTabs()
    expect(await axe(container)).toHaveNoViolations()
  })

  it("moves focus with ArrowRight/ArrowLeft in horizontal mode (automatic)", async () => {
    renderTabs()
    screen.getByRole("tab", { name: "One" }).focus()
    await userEvent.keyboard("{ArrowRight}")
    expect(screen.getByRole("tab", { name: "Two" })).toHaveFocus()
    expect(screen.getByRole("tab", { name: "Two" })).toHaveAttribute("aria-selected", "true")

    await userEvent.keyboard("{ArrowLeft}")
    expect(screen.getByRole("tab", { name: "One" })).toHaveFocus()
    expect(screen.getByRole("tab", { name: "One" })).toHaveAttribute("aria-selected", "true")
  })

  it("moves focus with ArrowDown/ArrowUp in vertical mode (automatic)", async () => {
    renderTabs({ orientation: "vertical" })
    screen.getByRole("tab", { name: "One" }).focus()
    await userEvent.keyboard("{ArrowDown}")
    expect(screen.getByRole("tab", { name: "Two" })).toHaveFocus()
    expect(screen.getByRole("tab", { name: "Two" })).toHaveAttribute("aria-selected", "true")

    await userEvent.keyboard("{ArrowUp}")
    expect(screen.getByRole("tab", { name: "One" })).toHaveFocus()
    expect(screen.getByRole("tab", { name: "One" })).toHaveAttribute("aria-selected", "true")
  })

  it("in manual mode, arrow keys move focus but do not select", async () => {
    renderTabs({ activationMode: "manual" })
    screen.getByRole("tab", { name: "One" }).focus()
    await userEvent.keyboard("{ArrowRight}")
    expect(screen.getByRole("tab", { name: "Two" })).toHaveFocus()
    expect(screen.getByRole("tab", { name: "One" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByRole("tab", { name: "Two" })).toHaveAttribute("aria-selected", "false")
  })

  it("in manual mode, Enter activates the focused tab", async () => {
    renderTabs({ activationMode: "manual" })
    screen.getByRole("tab", { name: "One" }).focus()
    await userEvent.keyboard("{ArrowRight}")
    expect(screen.getByRole("tab", { name: "Two" })).toHaveFocus()
    await userEvent.keyboard("{Enter}")
    expect(screen.getByRole("tab", { name: "Two" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByText("Content two")).not.toHaveAttribute("hidden")
  })

  it("wraps focus around by default", async () => {
    renderTabs({ activationMode: "manual" })
    screen.getByRole("tab", { name: "One" }).focus()
    await userEvent.keyboard("{ArrowRight}")
    await userEvent.keyboard("{ArrowRight}")
    expect(screen.getByRole("tab", { name: "Three" })).toHaveFocus()
    await userEvent.keyboard("{ArrowRight}")
    expect(screen.getByRole("tab", { name: "One" })).toHaveFocus()
  })

  it("in manual mode, Space activates the focused tab", async () => {
    renderTabs({ activationMode: "manual" })
    screen.getByRole("tab", { name: "One" }).focus()

    await userEvent.keyboard("{ArrowRight}")
    expect(screen.getByRole("tab", { name: "Two" })).toHaveFocus()
    expect(screen.getByRole("tab", { name: "Two" })).toHaveAttribute("aria-selected", "false")

    await userEvent.keyboard(" ")
    expect(screen.getByRole("tab", { name: "Two" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByText("Content two")).not.toHaveAttribute("hidden")
  })

  it("selects the first enabled tab when uncontrolled tabs have no default value", () => {
    render(
      <Tabs>
        <Tabs.List>
          <Tabs.Trigger value="one">One</Tabs.Trigger>
          <Tabs.Trigger value="two">Two</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="one">Content one</Tabs.Content>
        <Tabs.Content value="two">Content two</Tabs.Content>
      </Tabs>
    )
    expect(screen.getByRole("tab", { name: "One" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByRole("tab", { name: "One" })).toHaveAttribute("tabindex", "0")
    expect(screen.getByText("Content one")).not.toHaveAttribute("hidden")
  })

  it("moves selection when the active uncontrolled tab is removed", async () => {
    function RemovableTabs() {
      const [showFirst, setShowFirst] = useState(true)

      return (
        <>
          <button type="button" onClick={() => setShowFirst(false)}>Remove first</button>
          <Tabs defaultValue="one">
            <Tabs.List>
              {showFirst && <Tabs.Trigger value="one">One</Tabs.Trigger>}
              <Tabs.Trigger value="two">Two</Tabs.Trigger>
            </Tabs.List>
            {showFirst && <Tabs.Content value="one">Content one</Tabs.Content>}
            <Tabs.Content value="two">Content two</Tabs.Content>
          </Tabs>
        </>
      )
    }

    render(<RemovableTabs />)
    expect(screen.getByRole("tab", { name: "One" })).toHaveAttribute("aria-selected", "true")

    await userEvent.click(screen.getByRole("button", { name: "Remove first" }))
    expect(screen.getByRole("tab", { name: "Two" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByRole("tab", { name: "Two" })).toHaveAttribute("tabindex", "0")
  })

  it("uses the latest onValueChange callback after rerender", async () => {
    const firstCallback = vi.fn()
    const secondCallback = vi.fn()
    const { rerender } = render(
      <Tabs defaultValue="one" onValueChange={firstCallback}>
        <Tabs.List>
          <Tabs.Trigger value="one">One</Tabs.Trigger>
          <Tabs.Trigger value="two">Two</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="one">Content one</Tabs.Content>
        <Tabs.Content value="two">Content two</Tabs.Content>
      </Tabs>
    )

    rerender(
      <Tabs defaultValue="one" onValueChange={secondCallback}>
        <Tabs.List>
          <Tabs.Trigger value="one">One</Tabs.Trigger>
          <Tabs.Trigger value="two">Two</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="one">Content one</Tabs.Content>
        <Tabs.Content value="two">Content two</Tabs.Content>
      </Tabs>
    )

    await userEvent.click(screen.getByRole("tab", { name: "Two" }))
    expect(firstCallback).not.toHaveBeenCalled()
    expect(secondCallback).toHaveBeenCalledWith("two")
  })

  it("composes consumer click handlers with internal selection", async () => {
    const onClick = vi.fn()
    render(
      <Tabs defaultValue="one">
        <Tabs.List>
          <Tabs.Trigger value="one">One</Tabs.Trigger>
          <Tabs.Trigger value="two" onClick={onClick}>Two</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="one">Content one</Tabs.Content>
        <Tabs.Content value="two">Content two</Tabs.Content>
      </Tabs>
    )

    await userEvent.click(screen.getByRole("tab", { name: "Two" }))
    expect(onClick).toHaveBeenCalled()
    expect(screen.getByRole("tab", { name: "Two" })).toHaveAttribute("aria-selected", "true")
  })
})
