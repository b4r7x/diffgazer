import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { Textarea } from "./index.js"

describe("Textarea", () => {
  it("accepts multiline text as a native textbox", async () => {
    render(<Textarea aria-label="Comment" />)

    await userEvent.type(screen.getByRole("textbox", { name: "Comment" }), "Line one{enter}Line two")

    expect(screen.getByRole("textbox", { name: "Comment" })).toHaveValue("Line one\nLine two")
  })

  it("exposes invalid state through aria-invalid", () => {
    render(<Textarea aria-label="Comment" invalid />)

    expect(screen.getByRole("textbox", { name: "Comment" })).toHaveAttribute("aria-invalid", "true")
  })

  it("does not style aria-invalid false as invalid", () => {
    render(<Textarea aria-label="Comment" aria-invalid="false" />)

    const textarea = screen.getByRole("textbox", { name: "Comment" })
    expect(textarea).toHaveAttribute("aria-invalid", "false")
    expect(textarea).not.toHaveClass("border-destructive")
  })

  it("preserves grammar invalid state", () => {
    render(<Textarea aria-label="Comment" aria-invalid="grammar" />)

    const textarea = screen.getByRole("textbox", { name: "Comment" })
    expect(textarea).toHaveAttribute("aria-invalid", "grammar")
    expect(textarea).toHaveClass("border-destructive")
  })
})
