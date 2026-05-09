import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { Input, InputGroup } from "../input/index.js"
import { Textarea } from "../textarea/index.js"
import { Field } from "./index.js"

describe("Field", () => {
  it("wires required, invalid, description, and error state to the control", () => {
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

  it("wires disabled state and custom control ids to the control", () => {
    render(
      <Field controlId="project-name" disabled>
        <Field.Label>Project name</Field.Label>
        <Field.Control>
          <Input />
        </Field.Control>
      </Field>,
    )

    const input = screen.getByRole("textbox", { name: "Project name" })

    expect(input).toHaveAttribute("id", "project-name")
    expect(input).toBeDisabled()
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

  it("composes form wiring with decorated inputs", () => {
    render(
      <Field required>
        <Field.Label>Repository path</Field.Label>
        <Field.Control>
          <InputGroup prefix="~/" suffix=".json" />
        </Field.Control>
        <Field.Description>Relative config path.</Field.Description>
      </Field>,
    )

    const input = screen.getByRole("textbox", { name: "Repository path" })

    expect(input).toBeRequired()
    expect(input).toHaveAccessibleDescription("Relative config path.")
    expect(screen.getByText("~/")).toBeInTheDocument()
    expect(screen.getByText(".json")).toBeInTheDocument()
  })

  it("composes form wiring with textareas", () => {
    render(
      <Field invalid>
        <Field.Label>Review notes</Field.Label>
        <Field.Control>
          <Textarea />
        </Field.Control>
        <Field.Error>Notes are required.</Field.Error>
      </Field>,
    )

    const textarea = screen.getByRole("textbox", { name: "Review notes" })

    expect(textarea).toHaveAttribute("aria-invalid", "true")
    expect(textarea).toHaveAccessibleDescription("Notes are required.")
  })
})
