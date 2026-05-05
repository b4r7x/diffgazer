import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { axe } from "../../../testing/utils.js"
import { describe, it, expect } from "vitest"
import { Callout } from "./index.js"

describe("Callout", () => {
  it("renders children", () => {
    render(<Callout>Info message</Callout>)
    expect(screen.getByText("Info message")).toBeInTheDocument()
  })

  it("is hidden when visible=false", () => {
    render(<Callout visible={false}>Info message</Callout>)
    expect(screen.queryByText("Info message")).not.toBeInTheDocument()
  })

  it("dismiss button hides the callout", async () => {
    const user = userEvent.setup()
    render(
      <Callout>
        <Callout.Title>Alert</Callout.Title>
        <Callout.Dismiss />
      </Callout>
    )
    expect(screen.getByText("Alert")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Dismiss" }))
    expect(screen.queryByText("Alert")).not.toBeInTheDocument()
  })

  it("uses role=alert for error variant", () => {
    render(<Callout variant="error">Error</Callout>)
    expect(screen.getByRole("alert")).toBeInTheDocument()
  })

  it("uses role=status for warning variant", () => {
    render(<Callout variant="warning">Warning</Callout>)
    expect(screen.getByRole("status")).toBeInTheDocument()
  })
})

describe("Callout accessibility", () => {
  it("has no a11y violations across variants", async () => {
    for (const variant of ["info", "warning", "error", "success"] as const) {
      const { container, unmount } = render(<Callout variant={variant}>{variant} message</Callout>)
      expect(await axe(container)).toHaveNoViolations()
      unmount()
    }
  })
})

describe("Callout dismiss keyboard accessibility", () => {
  it("dismiss button is focusable and activatable via keyboard", async () => {
    const user = userEvent.setup()
    render(
      <Callout variant="info">
        <Callout.Title>Alert</Callout.Title>
        <Callout.Dismiss />
      </Callout>
    )

    await user.tab()
    expect(screen.getByRole("button", { name: "Dismiss" })).toHaveFocus()

    await user.keyboard("{Enter}")
    expect(screen.queryByText("Alert")).not.toBeInTheDocument()
  })
})
