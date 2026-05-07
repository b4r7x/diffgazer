import { createRef } from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { axe } from "../../../testing/utils.js"
import { describe, it, expect, vi } from "vitest"
import { Accordion } from "./index.js"

function renderAccordion(props: Record<string, unknown> = {}) {
  return render(
    <Accordion {...props}>
      <Accordion.Item value="one">
        <Accordion.Header>
          <Accordion.Trigger>Section One</Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Content>Content One</Accordion.Content>
      </Accordion.Item>
      <Accordion.Item value="two">
        <Accordion.Header>
          <Accordion.Trigger>Section Two</Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Content>Content Two</Accordion.Content>
      </Accordion.Item>
      <Accordion.Item value="three">
        <Accordion.Header>
          <Accordion.Trigger>Section Three</Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Content>Content Three</Accordion.Content>
      </Accordion.Item>
    </Accordion>
  )
}

describe("Accordion", () => {
  it("opens an item when its trigger is clicked", async () => {
    renderAccordion()
    const trigger = screen.getByRole("button", { name: "Section One" })
    expect(trigger).toHaveAttribute("aria-expanded", "false")
    await userEvent.click(trigger)
    expect(trigger).toHaveAttribute("aria-expanded", "true")
  })

  it("closes an open item when clicked again (collapsible by default)", async () => {
    renderAccordion({ defaultValue: "one" })
    const trigger = screen.getByRole("button", { name: "Section One" })
    expect(trigger).toHaveAttribute("aria-expanded", "true")
    await userEvent.click(trigger)
    expect(trigger).toHaveAttribute("aria-expanded", "false")
  })

  it("single mode closes previous item when another is opened", async () => {
    renderAccordion({ defaultValue: "one" })
    const triggerOne = screen.getByRole("button", { name: "Section One" })
    const triggerTwo = screen.getByRole("button", { name: "Section Two" })
    expect(triggerOne).toHaveAttribute("aria-expanded", "true")
    await userEvent.click(triggerTwo)
    expect(triggerOne).toHaveAttribute("aria-expanded", "false")
    expect(triggerTwo).toHaveAttribute("aria-expanded", "true")
  })

  it("single mode with collapsible=false prevents closing the open item", async () => {
    renderAccordion({ defaultValue: "one", collapsible: false })
    const trigger = screen.getByRole("button", { name: "Section One" })
    expect(trigger).toHaveAttribute("aria-expanded", "true")
    expect(trigger).not.toBeDisabled()
    expect(trigger).toHaveAttribute("aria-disabled", "true")
    trigger.focus()
    expect(trigger).toHaveFocus()
    await userEvent.click(trigger)
    expect(trigger).toHaveAttribute("aria-expanded", "true")
  })

  it("multiple mode allows several items open and toggles independently", async () => {
    renderAccordion({ type: "multiple" })
    const triggerOne = screen.getByRole("button", { name: "Section One" })
    const triggerTwo = screen.getByRole("button", { name: "Section Two" })
    await userEvent.click(triggerOne)
    await userEvent.click(triggerTwo)
    expect(triggerOne).toHaveAttribute("aria-expanded", "true")
    expect(triggerTwo).toHaveAttribute("aria-expanded", "true")
    await userEvent.click(triggerOne)
    expect(triggerOne).toHaveAttribute("aria-expanded", "false")
    expect(triggerTwo).toHaveAttribute("aria-expanded", "true")
  })

  it("does not toggle a disabled item", async () => {
    render(
      <Accordion>
        <Accordion.Item value="one" disabled>
          <Accordion.Header>
            <Accordion.Trigger>Disabled</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content>Hidden</Accordion.Content>
        </Accordion.Item>
      </Accordion>
    )
    const trigger = screen.getByRole("button", { name: "Disabled" })
    expect(trigger).toBeDisabled()
    await userEvent.click(trigger)
    expect(trigger).toHaveAttribute("aria-expanded", "false")
  })

  it("works uncontrolled with defaultValue (multiple)", async () => {
    renderAccordion({ type: "multiple", defaultValue: ["one", "three"] })
    expect(screen.getByRole("button", { name: "Section One" })).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByRole("button", { name: "Section Two" })).toHaveAttribute("aria-expanded", "false")
    expect(screen.getByRole("button", { name: "Section Three" })).toHaveAttribute("aria-expanded", "true")
  })

  it("controlled single mode calls onChange with new value", async () => {
    const onChange = vi.fn()
    renderAccordion({ value: "one", onChange })
    await userEvent.click(screen.getByRole("button", { name: "Section Two" }))
    expect(onChange).toHaveBeenCalledWith("two")
  })

  it("controlled single mode calls onValueChange with new value", async () => {
    const onValueChange = vi.fn()
    renderAccordion({ value: "one", onValueChange })
    await userEvent.click(screen.getByRole("button", { name: "Section Two" }))
    expect(onValueChange).toHaveBeenCalledWith("two")
  })

  it("controlled multiple mode calls onChange with updated array", async () => {
    const onChange = vi.fn()
    renderAccordion({ type: "multiple", value: ["one"], onChange })
    await userEvent.click(screen.getByRole("button", { name: "Section Two" }))
    expect(onChange).toHaveBeenCalledWith(["one", "two"])
  })

  it("forwards trigger props and honors preventDefault in consumer click handlers", async () => {
    const ref = createRef<HTMLButtonElement>()
    const onClick = vi.fn((event) => event.preventDefault())

    render(
      <Accordion>
        <Accordion.Item value="one">
          <Accordion.Header>
            <Accordion.Trigger ref={ref} data-testid="trigger" onClick={onClick}>
              Section One
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content>Content One</Accordion.Content>
        </Accordion.Item>
      </Accordion>,
    )

    const trigger = screen.getByTestId("trigger")
    expect(ref.current).toBe(trigger)
    await userEvent.click(trigger)
    expect(onClick).toHaveBeenCalledOnce()
    expect(trigger).toHaveAttribute("aria-expanded", "false")
  })

  it("has no a11y violations", async () => {
    const { container } = renderAccordion()
    expect(await axe(container)).toHaveNoViolations()
  })

  it("uses native button semantics without a redundant role attribute", () => {
    renderAccordion()
    expect(screen.getByRole("button", { name: "Section One" })).not.toHaveAttribute("role")
  })

  it("ArrowDown/ArrowUp moves focus between triggers", async () => {
    renderAccordion()
    const triggerOne = screen.getByRole("button", { name: "Section One" })
    const triggerTwo = screen.getByRole("button", { name: "Section Two" })
    triggerOne.focus()
    await userEvent.keyboard("{ArrowDown}")
    expect(triggerTwo).toHaveFocus()
    await userEvent.keyboard("{ArrowUp}")
    expect(triggerOne).toHaveFocus()
  })

  it("does not handle arrow navigation when focus is inside panel content", async () => {
    render(
      <Accordion defaultValue="one">
        <Accordion.Item value="one">
          <Accordion.Header>
            <Accordion.Trigger>Section One</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content>
            <input aria-label="Panel field" />
          </Accordion.Content>
        </Accordion.Item>
        <Accordion.Item value="two">
          <Accordion.Header>
            <Accordion.Trigger>Section Two</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content>Content Two</Accordion.Content>
        </Accordion.Item>
      </Accordion>,
    )
    const input = screen.getByRole("textbox", { name: "Panel field" })
    input.focus()

    await userEvent.keyboard("{ArrowDown}")

    expect(input).toHaveFocus()
    expect(screen.getByRole("button", { name: "Section Two" })).not.toHaveFocus()
  })

  it("ArrowDown/ArrowUp wraps around at boundaries", async () => {
    renderAccordion()
    const triggerOne = screen.getByRole("button", { name: "Section One" })
    const triggerThree = screen.getByRole("button", { name: "Section Three" })
    triggerOne.focus()
    await userEvent.keyboard("{ArrowDown}")
    await userEvent.keyboard("{ArrowDown}")
    expect(triggerThree).toHaveFocus()
    await userEvent.keyboard("{ArrowDown}")
    expect(triggerOne).toHaveFocus()
    await userEvent.keyboard("{ArrowUp}")
    expect(triggerThree).toHaveFocus()
  })

  it("keeps aria-disabled non-collapsible triggers in roving order and skips disabled items", async () => {
    render(
      <Accordion defaultValue="one" collapsible={false}>
        <Accordion.Item value="one">
          <Accordion.Header>
            <Accordion.Trigger>Section One</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content>Content One</Accordion.Content>
        </Accordion.Item>
        <Accordion.Item value="two" disabled>
          <Accordion.Header>
            <Accordion.Trigger>Section Two</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content>Content Two</Accordion.Content>
        </Accordion.Item>
        <Accordion.Item value="three">
          <Accordion.Header>
            <Accordion.Trigger>Section Three</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content>Content Three</Accordion.Content>
        </Accordion.Item>
      </Accordion>,
    )
    const triggerOne = screen.getByRole("button", { name: "Section One" })
    const triggerThree = screen.getByRole("button", { name: "Section Three" })
    expect(triggerOne).toHaveAttribute("aria-disabled", "true")

    triggerThree.focus()
    await userEvent.keyboard("{ArrowDown}")
    expect(triggerOne).toHaveFocus()

    await userEvent.keyboard("{ArrowDown}")
    expect(triggerThree).toHaveFocus()
  })
})

describe("Accordion inert on collapsed content", () => {
  it("collapsed content is inert, expanded content is not", async () => {
    render(
      <Accordion type="single" defaultValue="one">
        <Accordion.Item value="one">
          <Accordion.Header>
            <Accordion.Trigger>Section One</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content>
            <button>Button One</button>
          </Accordion.Content>
        </Accordion.Item>
        <Accordion.Item value="two">
          <Accordion.Header>
            <Accordion.Trigger>Section Two</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content>
            <button>Button Two</button>
          </Accordion.Content>
        </Accordion.Item>
      </Accordion>
    )

    const expandedRegion = screen.getByText("Button One").closest("[role='region']")
    if (!expandedRegion?.parentElement) throw new Error("Expected expanded accordion region wrapper")
    const expandedContent = expandedRegion.parentElement
    expect(expandedContent).not.toHaveAttribute("inert")

    const collapsedRegion = screen.getByText("Button Two").closest("[role='region']")
    if (!collapsedRegion?.parentElement) throw new Error("Expected collapsed accordion region wrapper")
    const collapsedContent = collapsedRegion.parentElement
    expect(collapsedContent).toHaveAttribute("inert")
  })
})
