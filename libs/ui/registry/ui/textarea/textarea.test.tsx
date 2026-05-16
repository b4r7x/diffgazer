import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { axe } from "../../../testing/utils.js"
import { Textarea } from "./index.js"

describe("Textarea", () => {
  it("accepts multiline text as a native textbox", async () => {
    const user = userEvent.setup()

    render(<Textarea aria-label="Comment" />)

    await user.type(screen.getByRole("textbox", { name: "Comment" }), "Line one{enter}Line two")

    expect(screen.getByRole("textbox", { name: "Comment" })).toHaveValue("Line one\nLine two")
  })

  it("passes the native change event to onChange", async () => {
    const user = userEvent.setup()
    let eventValue = ""
    let eventTarget: EventTarget | null = null

    render(
      <Textarea
        aria-label="Comment"
        onChange={(event) => {
          eventValue = event.currentTarget.value
          eventTarget = event.target
        }}
      />,
    )

    const textarea = screen.getByRole("textbox", { name: "Comment" })
    await user.type(textarea, "a")

    expect(eventValue).toBe("a")
    expect(eventTarget).toBe(textarea)
  })

  it("forwards aria-invalid to the native textarea", () => {
    render(<Textarea aria-label="Comment" aria-invalid />)

    expect(screen.getByRole("textbox", { name: "Comment" })).toHaveAttribute("aria-invalid", "true")
  })

  it("preserves aria-invalid false as a non-invalid value", () => {
    render(<Textarea aria-label="Comment" aria-invalid="false" />)

    const textarea = screen.getByRole("textbox", { name: "Comment" })
    expect(textarea).toHaveAttribute("aria-invalid", "false")
  })

  it("preserves grammar invalid state", () => {
    render(<Textarea aria-label="Comment" aria-invalid="grammar" />)

    const textarea = screen.getByRole("textbox", { name: "Comment" })
    expect(textarea).toHaveAttribute("aria-invalid", "grammar")
  })

  it("has no a11y violations across Textarea states", async () => {
    const { container, rerender } = render(<Textarea aria-label="Comment" />)
    expect(await axe(container)).toHaveNoViolations()

    rerender(<Textarea aria-label="Comment" aria-invalid />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
