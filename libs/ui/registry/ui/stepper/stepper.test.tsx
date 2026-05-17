import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { axe } from "../../../testing/utils.js"
import { afterAll, beforeAll, describe, it, expect, vi } from "vitest"
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

  it("calls consumer trigger onClick before expanding", async () => {
    const onClick = vi.fn()
    render(
      <Stepper>
        <Stepper.Step stepId="s1" status="active">
          <Stepper.Trigger onClick={onClick}>Step 1</Stepper.Trigger>
          <Stepper.Content>Content 1</Stepper.Content>
        </Stepper.Step>
      </Stepper>,
    )
    const trigger = screen.getByRole("button", { name: /Step 1/ })

    await userEvent.click(trigger)

    expect(onClick).toHaveBeenCalled()
    expect(trigger).toHaveAttribute("aria-expanded", "true")
  })

  it("does not expand when trigger click is prevented", async () => {
    render(
      <Stepper>
        <Stepper.Step stepId="s1" status="active">
          <Stepper.Trigger onClick={(event) => event.preventDefault()}>Step 1</Stepper.Trigger>
          <Stepper.Content>Content 1</Stepper.Content>
        </Stepper.Step>
      </Stepper>,
    )
    const trigger = screen.getByRole("button", { name: /Step 1/ })

    await userEvent.click(trigger)

    expect(trigger).toHaveAttribute("aria-expanded", "false")
  })

  it("only emits aria-controls when the referenced content exists", () => {
    render(
      <Stepper>
        <Stepper.Step stepId="s1" status="active">
          <Stepper.Trigger>With content</Stepper.Trigger>
          <Stepper.Content>Content 1</Stepper.Content>
        </Stepper.Step>
        <Stepper.Step stepId="s2" status="pending">
          <Stepper.Trigger>No content</Stepper.Trigger>
        </Stepper.Step>
      </Stepper>,
    )

    const withContent = screen.getByRole("button", { name: /With content/ })
    const withoutContent = screen.getByRole("button", { name: /No content/ })
    const contentId = withContent.getAttribute("aria-controls")

    expect(contentId).toBeTruthy()
    expect(document.getElementById(contentId!)).toBeInTheDocument()
    expect(withoutContent).not.toHaveAttribute("aria-controls")
    expect(withoutContent).not.toHaveAttribute("aria-expanded")
  })

  it("does not toggle steps that have no content", async () => {
    const onExpandedChange = vi.fn()
    render(
      <Stepper onExpandedChange={onExpandedChange}>
        <Stepper.Step stepId="s1" status="active">
          <Stepper.Trigger>No content</Stepper.Trigger>
        </Stepper.Step>
      </Stepper>,
    )

    const trigger = screen.getByRole("button", { name: /No content/ })
    await userEvent.click(trigger)

    expect(onExpandedChange).not.toHaveBeenCalled()
    expect(trigger).not.toHaveAttribute("aria-expanded")
  })

  it("has no a11y violations", async () => {
    const { container } = renderStepper({ defaultExpandedIds: ["s1"] })
    expect(await axe(container)).toHaveNoViolations()
  })

  it("renders neutral default badge labels when no statusLabels prop is provided", () => {
    render(
      <Stepper>
        <Stepper.Step stepId="s1" status="completed">
          <Stepper.Trigger>Step 1</Stepper.Trigger>
        </Stepper.Step>
        <Stepper.Step stepId="s2" status="active">
          <Stepper.Trigger>Step 2</Stepper.Trigger>
        </Stepper.Step>
        <Stepper.Step stepId="s3" status="pending">
          <Stepper.Trigger>Step 3</Stepper.Trigger>
        </Stepper.Step>
        <Stepper.Step stepId="s4" status="error">
          <Stepper.Trigger>Step 4</Stepper.Trigger>
        </Stepper.Step>
      </Stepper>,
    )
    expect(screen.getByRole("button", { name: /Step 1/ })).toHaveTextContent("Completed")
    expect(screen.getByRole("button", { name: /Step 2/ })).toHaveTextContent("Active")
    expect(screen.getByRole("button", { name: /Step 3/ })).toHaveTextContent("Pending")
    expect(screen.getByRole("button", { name: /Step 4/ })).toHaveTextContent("Error")
  })

  it("uses provided statusLabels for trigger badges", () => {
    render(
      <Stepper>
        <Stepper.Step stepId="s1" status="completed">
          <Stepper.Trigger statusLabels={{ completed: "DONE", active: "RUN" }}>
            Step 1
          </Stepper.Trigger>
        </Stepper.Step>
        <Stepper.Step stepId="s2" status="active">
          <Stepper.Trigger statusLabels={{ completed: "DONE", active: "RUN" }}>
            Step 2
          </Stepper.Trigger>
        </Stepper.Step>
      </Stepper>,
    )
    expect(screen.getByRole("button", { name: /Step 1/ })).toHaveTextContent("DONE")
    expect(screen.getByRole("button", { name: /Step 2/ })).toHaveTextContent("RUN")
  })

  it("uses provided statusLabels for substep fallback text", () => {
    render(
      <Stepper defaultExpandedIds={["s1"]}>
        <Stepper.Step stepId="s1" status="active">
          <Stepper.Trigger>Step 1</Stepper.Trigger>
          <Stepper.Content>
            <Stepper.Substep
              tag="A"
              label="Substep A"
              status="active"
              statusLabels={{ active: "analyzing..." }}
            />
            <Stepper.Substep tag="B" label="Substep B" status="completed" detail="custom detail" />
          </Stepper.Content>
        </Stepper.Step>
      </Stepper>,
    )
    expect(screen.getByText("analyzing...")).toBeInTheDocument()
    // detail wins over statusLabels fallback
    expect(screen.getByText("custom detail")).toBeInTheDocument()
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

describe("Stepper prefers-reduced-motion", () => {
  // The grid-template-rows transition that animates expand/collapse must be
  // suppressed under prefers-reduced-motion. The active-substep pulse is
  // gated by Tailwind's motion-safe variant. jsdom does not evaluate @media
  // in stylesheets, so Tailwind's compiled declarations are injected
  // unconditionally to simulate matchMedia returning true; getComputedStyle
  // then reports the suppressed transition and absent animation.
  let styleElement: HTMLStyleElement | null = null

  beforeAll(() => {
    styleElement = document.createElement("style")
    styleElement.dataset.testSource = "tailwind#motion-reduce+motion-safe"
    styleElement.textContent = `
      .motion-reduce\\:transition-none { transition-property: none; }
      .motion-safe\\:animate-pulse { animation: none; }
    `
    document.head.appendChild(styleElement)
  })

  afterAll(() => {
    styleElement?.remove()
    styleElement = null
  })

  it("suppresses the grid-row transition on the animated wrapper", () => {
    renderStepper({ defaultExpandedIds: ["s1"] })
    const region = screen.getByRole("region", { name: /Step 1/ })
    expect(region.className).toMatch(/motion-reduce:transition-none/)
    expect(getComputedStyle(region).transitionProperty).toBe("none")
  })

  it("applies the active substep pulse only via motion-safe variant", () => {
    render(
      <Stepper>
        <Stepper.Step stepId="s1" status="active">
          <Stepper.Trigger>Step 1</Stepper.Trigger>
          <Stepper.Content>
            <Stepper.Substep tag="A" label="Working" status="active" />
          </Stepper.Content>
        </Stepper.Step>
      </Stepper>,
    )

    const substep = screen.getByText("Working").parentElement
    if (!substep) throw new Error("Expected substep label to have a parent element")
    expect(substep.className).toMatch(/motion-safe:animate-pulse/)
    expect(substep.className).not.toMatch(/(?:^|\s)animate-pulse(?:\s|$)/)
    expect(getComputedStyle(substep).animation).toBe("none")
  })
})
