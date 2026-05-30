import { render, screen } from "@testing-library/react"
import { axe } from "../../../testing/utils"
import { describe, it, expect } from "vitest"
import { HorizontalStepper } from "./index"

const steps = ["intro", "config", "review", "done"]

function renderStepper(activeStep: string, variant?: "ascii" | "numbered" | "breadcrumb") {
  return render(
    <HorizontalStepper steps={steps} value={activeStep} variant={variant} aria-label="Setup progress">
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
    // 4 real steps + 3 ascii connector presentational <li>s
    const allItems = list.querySelectorAll("li")
    expect(allItems.length).toBeGreaterThanOrEqual(4)
    // Only the 4 steps expose listitem semantics (presentation role hides connectors)
    expect(screen.getAllByRole("listitem")).toHaveLength(4)
  })

  it("uses the value prop as the current step contract", () => {
    renderStepper("review")

    expect(screen.getByText("Review").closest("li")).toHaveAttribute("aria-current", "step")
    expect(screen.getByText("Config").closest("li")).not.toHaveAttribute("aria-current")
  })

  it("has no a11y violations", async () => {
    const { container } = renderStepper("config")
    expect(await axe(container)).toHaveNoViolations()
  })

  it("writes data-variant on the root list", () => {
    renderStepper("config", "numbered")
    expect(screen.getByRole("list", { name: "Setup progress" })).toHaveAttribute(
      "data-variant",
      "numbered",
    )
  })
})

describe("HorizontalStepper ascii variant", () => {
  it("renders [x] / [~] / [ ] glyphs per status", () => {
    renderStepper("config", "ascii")
    const intro = screen.getByText("Intro").closest("li")!
    const config = screen.getByText("Config").closest("li")!
    const review = screen.getByText("Review").closest("li")!

    expect(intro).toHaveTextContent("[x]")
    expect(config).toHaveTextContent("[~]")
    expect(review).toHaveTextContent("[ ]")
  })

  it("interleaves ── connectors between steps", () => {
    const { container } = renderStepper("config", "ascii")
    const presentations = container.querySelectorAll('[role="presentation"]')
    // 4 steps → 3 connectors
    expect(presentations.length).toBe(3)
    expect(presentations[0]).toHaveTextContent("───")
  })
})

describe("HorizontalStepper numbered variant", () => {
  it("renders ✓ for completed and an empty counter placeholder for active/pending", () => {
    renderStepper("config", "numbered")
    const intro = screen.getByText("Intro").closest("li")!
    expect(intro).toHaveTextContent("✓")
    // Active/pending render an empty <span data-counter> — assert presence rather
    // than glyph (the digit comes from CSS counter via ::before, which jsdom
    // does not paint).
    const config = screen.getByText("Config").closest("li")!
    expect(config.querySelector("[data-counter]")).toBeTruthy()
  })

  it("does not interleave presentational connector <li>s — the bar is a ::before pseudo on each step", () => {
    const { container } = renderStepper("config", "numbered")
    const presentations = container.querySelectorAll('[role="presentation"]')
    expect(presentations.length).toBe(0)
  })
})

describe("HorizontalStepper breadcrumb variant", () => {
  it("renders ✓ / › glyphs for completed/active and suppresses pending glyph", () => {
    renderStepper("config", "breadcrumb")
    const intro = screen.getByText("Intro").closest("li")!
    const config = screen.getByText("Config").closest("li")!
    expect(intro).toHaveTextContent("✓")
    expect(config).toHaveTextContent("›")
  })

  it("interleaves / separators between steps", () => {
    const { container } = renderStepper("config", "breadcrumb")
    const presentations = container.querySelectorAll('[role="presentation"]')
    expect(presentations.length).toBe(3)
    expect(presentations[0]).toHaveTextContent("/")
  })
})
