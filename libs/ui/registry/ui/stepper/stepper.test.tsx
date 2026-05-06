import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { axe } from "../../../testing/utils.js"
import { describe, it, expect, vi } from "vitest"
import { Stepper } from "./index.js"

function renderStepper(props: Record<string, unknown> = {}) {
  return render(
    <Stepper {...props}>
      <Stepper.Step stepId="s1" status="completed">
        <Stepper.Trigger>Step 1</Stepper.Trigger>
        <Stepper.Content>Content 1</Stepper.Content>
      </Stepper.Step>
      <Stepper.Step stepId="s2" status="active">
        <Stepper.Trigger>Step 2</Stepper.Trigger>
        <Stepper.Content>Content 2</Stepper.Content>
      </Stepper.Step>
      <Stepper.Step stepId="s3" status="pending">
        <Stepper.Trigger>Step 3</Stepper.Trigger>
        <Stepper.Content>Content 3</Stepper.Content>
      </Stepper.Step>
    </Stepper>
  )
}

describe("Stepper", () => {
  it("expands step content when trigger is clicked", async () => {
    renderStepper()
    const trigger = screen.getByRole("button", { name: /Step 1/ })
    await userEvent.click(trigger)
    expect(trigger).toHaveAttribute("aria-expanded", "true")
    const region = screen.getByRole("region", { name: /Step 1/ })
    expect(region).not.toHaveAttribute("aria-hidden")
  })

  it("collapses an expanded step when trigger is clicked again", async () => {
    renderStepper({ defaultExpandedIds: ["s1"] })
    const trigger = screen.getByRole("button", { name: /Step 1/ })
    expect(trigger).toHaveAttribute("aria-expanded", "true")

    await userEvent.click(trigger)
    expect(trigger).toHaveAttribute("aria-expanded", "false")
  })

  it("expands steps matching defaultExpandedIds initially", () => {
    renderStepper({ defaultExpandedIds: ["s1", "s2"] })
    expect(screen.getByRole("button", { name: /Step 1/ })).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByRole("button", { name: /Step 2/ })).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByRole("button", { name: /Step 3/ })).toHaveAttribute("aria-expanded", "false")
  })

  it("fires onExpandedChange in controlled mode", async () => {
    const onExpandedChange = vi.fn()
    const { rerender } = render(
      <Stepper expandedIds={[]} onExpandedChange={onExpandedChange}>
        <Stepper.Step stepId="s1" status="active">
          <Stepper.Trigger>Step 1</Stepper.Trigger>
          <Stepper.Content>Content 1</Stepper.Content>
        </Stepper.Step>
      </Stepper>
    )
    await userEvent.click(screen.getByRole("button", { name: /Step 1/ }))
    expect(onExpandedChange).toHaveBeenCalledWith(["s1"])
    expect(screen.getByRole("button", { name: /Step 1/ })).toHaveAttribute("aria-expanded", "false")

    rerender(
      <Stepper expandedIds={["s1"]} onExpandedChange={onExpandedChange}>
        <Stepper.Step stepId="s1" status="active">
          <Stepper.Trigger>Step 1</Stepper.Trigger>
          <Stepper.Content>Content 1</Stepper.Content>
        </Stepper.Step>
      </Stepper>
    )
    expect(screen.getByRole("button", { name: /Step 1/ })).toHaveAttribute("aria-expanded", "true")
  })

  it("has no a11y violations", async () => {
    const { container } = renderStepper({ defaultExpandedIds: ["s1"] })
    expect(await axe(container)).toHaveNoViolations()
  })

  it("does not tab into collapsed step content", async () => {
    const user = userEvent.setup()
    render(
      <Stepper>
        <Stepper.Step stepId="s1" status="pending">
          <Stepper.Trigger>Step 1</Stepper.Trigger>
          <Stepper.Content>
            <button type="button">Hidden action</button>
          </Stepper.Content>
        </Stepper.Step>
        <Stepper.Step stepId="s2" status="active">
          <Stepper.Trigger>Step 2</Stepper.Trigger>
        </Stepper.Step>
      </Stepper>
    )

    const firstTrigger = screen.getByRole("button", { name: /Step 1/ })
    const region = document.getElementById(firstTrigger.getAttribute("aria-controls")!)
    expect(region).toHaveAttribute("inert")

    await user.tab()
    expect(firstTrigger).toHaveFocus()
    await user.tab()
    expect(screen.getByRole("button", { name: /Step 2/ })).toHaveFocus()
  })
})
