import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { Input } from "./index.js"

describe("Input", () => {
  it("accepts typed text as a native textbox", async () => {
    render(<Input aria-label="Email" />)

    await userEvent.type(screen.getByRole("textbox", { name: "Email" }), "a@example.com")

    expect(screen.getByRole("textbox", { name: "Email" })).toHaveValue("a@example.com")
  })

  it("exposes invalid state through aria-invalid", () => {
    const { rerender } = render(<Input aria-label="Email" invalid />)

    expect(screen.getByRole("textbox", { name: "Email" })).toHaveAttribute("aria-invalid", "true")

    rerender(<Input aria-label="Email" error />)

    expect(screen.getByRole("textbox", { name: "Email" })).toHaveAttribute("aria-invalid", "true")
  })

  it("does not style aria-invalid false as invalid", () => {
    render(<Input aria-label="Email" aria-invalid="false" />)

    const input = screen.getByRole("textbox", { name: "Email" })
    expect(input).toHaveAttribute("aria-invalid", "false")
    expect(input).not.toHaveClass("border-destructive")
  })

  it("preserves grammar invalid state", () => {
    render(<Input aria-label="Email" aria-invalid="grammar" />)

    const input = screen.getByRole("textbox", { name: "Email" })
    expect(input).toHaveAttribute("aria-invalid", "grammar")
    expect(input).toHaveClass("border-destructive")
  })
})
