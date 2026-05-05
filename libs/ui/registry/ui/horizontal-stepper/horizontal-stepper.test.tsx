import { render, screen } from "@testing-library/react"
import { axe } from "../../../testing/utils.js"
import { describe, it, expect } from "vitest"
import { HorizontalStepper } from "./index.js"

const steps = ["intro", "config", "review", "done"]

function renderStepper(activeStep: string) {
  return render(
    <HorizontalStepper steps={steps} step={activeStep} aria-label="Setup progress">
      <HorizontalStepper.Step value="intro">Intro</HorizontalStepper.Step>
      <HorizontalStepper.Step value="config">Config</HorizontalStepper.Step>
      <HorizontalStepper.Step value="review">Review</HorizontalStepper.Step>
      <HorizontalStepper.Step value="done">Done</HorizontalStepper.Step>
    </HorizontalStepper>
  )
}

describe("HorizontalStepper", () => {
  it("marks active step and provides screen reader labels for all statuses", () => {
    renderStepper("config")
    const configItem = screen.getByText("Config").closest("li")!
    expect(configItem).toHaveAttribute("aria-current", "step")
    expect(screen.getByText("Current:")).toBeInTheDocument()

    const introItem = screen.getByText("Intro").closest("li")!
    expect(introItem).not.toHaveAttribute("aria-current")
    expect(screen.getByText("Completed:")).toBeInTheDocument()

    expect(screen.getAllByText("Upcoming:")).toHaveLength(2)
  })

  it("renders as an ordered list with aria-label", () => {
    renderStepper("intro")
    const list = screen.getByRole("list", { name: "Setup progress" })
    expect(list).toBeInTheDocument()
    expect(screen.getAllByRole("listitem")).toHaveLength(4)
  })

  it("has no a11y violations", async () => {
    const { container } = renderStepper("config")
    expect(await axe(container)).toHaveNoViolations()
  })
})
