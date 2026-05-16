import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { axe } from "../../../testing/utils.js"
import { Input, InputGroup } from "../input/index.js"
import { Textarea } from "../textarea/index.js"
import { Select } from "../select/index.js"
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
      <Field controlId="repository-path" invalid required disabled>
        <Field.Label>Repository path</Field.Label>
        <Field.Control>
          <InputGroup prefix="~/" suffix=".json" />
        </Field.Control>
        <Field.Description>Relative config path.</Field.Description>
        <Field.Error>Repository path is required.</Field.Error>
      </Field>,
    )

    const input = screen.getByRole("textbox", { name: "Repository path" })

    expect(input).toHaveAttribute("id", "repository-path")
    expect(input).toBeRequired()
    expect(input).toBeDisabled()
    expect(input).toHaveAttribute("aria-invalid", "true")
    expect(input).toHaveAccessibleDescription("Relative config path. Repository path is required.")
    expect(screen.getByText("~/")).toBeInTheDocument()
    expect(screen.getByText(".json")).toBeInTheDocument()
    expect(screen.getByText("~/")).toHaveAttribute("aria-hidden", "true")
    expect(screen.getByText(".json")).toHaveAttribute("aria-hidden", "true")
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

  it("merges external aria-labelledby with the field label id", () => {
    render(
      <Field>
        <Field.Label>Username</Field.Label>
        <Field.Control>
          <Input aria-labelledby="external-label" />
        </Field.Control>
      </Field>,
    )

    const input = screen.getByRole("textbox")
    const labelledBy = input.getAttribute("aria-labelledby")!
    expect(labelledBy).toContain("external-label")

    const fieldLabel = screen.getByText("Username")
    expect(labelledBy).toContain(fieldLabel.id)
  })

  it("composes form wiring with Select on the combobox trigger", () => {
    render(
      <Field invalid required disabled>
        <Field.Label>Region</Field.Label>
        <Field.Control>
          <Select>
            <Select.Trigger>
              <Select.Value placeholder="Select a region" />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="us">United States</Select.Item>
              <Select.Item value="eu">Europe</Select.Item>
            </Select.Content>
          </Select>
        </Field.Control>
        <Field.Description>Choose where data is stored.</Field.Description>
        <Field.Error>Region is required.</Field.Error>
      </Field>,
    )

    const combobox = screen.getByRole("combobox", { name: "Region" })

    expect(combobox).toHaveAttribute("aria-invalid", "true")
    expect(combobox).toHaveAttribute("aria-required", "true")
    expect(combobox).toBeDisabled()
    expect(combobox).toHaveAccessibleDescription("Choose where data is stored. Region is required.")
    expect(combobox).toHaveAttribute("aria-labelledby")
    expect(combobox).not.toHaveAttribute("aria-label", "Select")
  })

  it("Field.Label uses the trigger id for htmlFor when composing with Select", () => {
    render(
      <Field controlId="region-select">
        <Field.Label>Region</Field.Label>
        <Field.Control>
          <Select>
            <Select.Trigger>
              <Select.Value placeholder="Select a region" />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="us">United States</Select.Item>
            </Select.Content>
          </Select>
        </Field.Control>
      </Field>,
    )

    const combobox = screen.getByRole("combobox", { name: "Region" })
    expect(combobox).toHaveAttribute("id", "region-select")
  })

  it("has no a11y violations across Field configurations", async () => {
    const { container, rerender } = render(
      <Field>
        <Field.Label>Project name</Field.Label>
        <Field.Control>
          <Input />
        </Field.Control>
        <Field.Description>Use a short, memorable name.</Field.Description>
      </Field>,
    )
    expect(await axe(container)).toHaveNoViolations()

    rerender(
      <Field invalid required>
        <Field.Label>Email</Field.Label>
        <Field.Control>
          <Input />
        </Field.Control>
        <Field.Description>Use your work email.</Field.Description>
        <Field.Error>Email is required.</Field.Error>
      </Field>,
    )
    expect(await axe(container)).toHaveNoViolations()

    rerender(
      <Field invalid>
        <Field.Label>Notes</Field.Label>
        <Field.Control>
          <Textarea />
        </Field.Control>
        <Field.Error>Notes are required.</Field.Error>
      </Field>,
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
