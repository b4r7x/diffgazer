import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { Input, InputGroup } from "./index.js"

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

  it("preserves aria-invalid false as a non-invalid value", () => {
    render(<Input aria-label="Email" aria-invalid="false" />)

    const input = screen.getByRole("textbox", { name: "Email" })
    expect(input).toHaveAttribute("aria-invalid", "false")
  })

  it("preserves grammar invalid state", () => {
    render(<Input aria-label="Email" aria-invalid="grammar" />)

    const input = screen.getByRole("textbox", { name: "Email" })
    expect(input).toHaveAttribute("aria-invalid", "grammar")
  })

  it("renders prefix and suffix affordances around the input", async () => {
    render(<InputGroup aria-label="Path" prefix="~/" suffix=".json" />)

    await userEvent.type(screen.getByRole("textbox", { name: "Path" }), "config")

    expect(screen.getByText("~/")).toBeInTheDocument()
    expect(screen.getByText(".json")).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "Path" })).toHaveValue("config")
  })

  it("exposes InputGroup invalid state through the nested input", () => {
    render(<InputGroup aria-label="Path" invalid />)

    expect(screen.getByRole("textbox", { name: "Path" })).toHaveAttribute("aria-invalid", "true")
  })
})
