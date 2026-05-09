import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { Input } from "../input/index.js"
import { Field } from "./index.js"

describe("Field", () => {
  it("associates label, description, error, and invalid state with the control", () => {
    render(
      <Field invalid required>
        <Field.Label>Email</Field.Label>
        <Field.Control>
          <Input />
        </Field.Control>
        <Field.Description>Use your work email.</Field.Description>
        <Field.Error>Email is required.</Field.Error>
      </Field>,
    )

    const input = screen.getByRole("textbox", { name: "Email" })

    expect(input).toBeRequired()
    expect(input).toHaveAttribute("aria-invalid", "true")
    expect(input).toHaveAccessibleDescription("Use your work email. Email is required.")
  })

  it("clicking the label focuses the control", async () => {
    const user = userEvent.setup()

    render(
      <Field>
        <Field.Label>Project name</Field.Label>
        <Field.Control>
          <Input />
        </Field.Control>
      </Field>,
    )

    await user.click(screen.getByText("Project name"))

    expect(screen.getByRole("textbox", { name: "Project name" })).toHaveFocus()
  })

  it("uses custom description and error ids for the control description", () => {
    render(
      <Field invalid>
        <Field.Label>Email</Field.Label>
        <Field.Control>
          <Input />
        </Field.Control>
        <Field.Description id="email-help">Use your work email.</Field.Description>
        <Field.Error id="email-error">Email is required.</Field.Error>
      </Field>,
    )

    const input = screen.getByRole("textbox", { name: "Email" })

    expect(input).toHaveAttribute("aria-describedby", "email-help email-error")
    expect(input).toHaveAccessibleDescription("Use your work email. Email is required.")
  })
})
