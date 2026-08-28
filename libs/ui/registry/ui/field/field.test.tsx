import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { describe, expect, it } from "vitest";
import { axe } from "../../../testing/axe";
import { requireAttribute } from "../../testing/assertions";
import { expectFieldDescribedBy, expectFieldInvalid } from "../../testing/form-behavior";
import { Input } from "../input/index";
import { Textarea } from "../textarea/index";
import { Field } from "./index";

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
    );

    const input = screen.getByRole("textbox", { name: "Email" });

    expect(input).toBeRequired();
    expectFieldInvalid(input, "Email is required. Use your work email.");
  });

  it("keeps the required marker out of the accessible name and off the error channel at rest", () => {
    const { rerender } = render(
      <Field required>
        <Field.Label>Email</Field.Label>
        <Field.Control>
          <Input />
        </Field.Control>
      </Field>,
    );

    // The marker is decoration; aria-required is the real signal and must not move.
    const input = screen.getByRole("textbox", { name: "Email" });
    expect(input).toBeRequired();
    const marker = screen.getByText("Email").querySelector('[aria-hidden="true"]');
    expect(marker).toHaveTextContent("*");

    // At rest the marker is muted and only escalates through the Field's data-invalid group,
    // so a resting form carries no error-hue glyphs at all.
    const field = input.closest("[data-slot='field']");
    expect(field).toHaveClass("group/field");
    expect(field).not.toHaveAttribute("data-invalid");

    rerender(
      <Field required invalid>
        <Field.Label>Email</Field.Label>
        <Field.Control>
          <Input />
        </Field.Control>
      </Field>,
    );
    expect(input.closest("[data-slot='field']")).toHaveAttribute("data-invalid");
    expect(screen.getByRole("textbox", { name: "Email" })).toBeRequired();
  });

  it("wires disabled state and custom control ids to the control", () => {
    render(
      <Field controlId="project-name" disabled>
        <Field.Label>Project name</Field.Label>
        <Field.Control>
          <Input />
        </Field.Control>
      </Field>,
    );

    const input = screen.getByRole("textbox", { name: "Project name" });

    expect(input).toHaveAttribute("id", "project-name");
    expect(input).toBeDisabled();
  });

  it("keeps a disabled Field authoritative when the child sets disabled to false", async () => {
    const { container } = render(
      <Field disabled>
        <Field.Label>Project name</Field.Label>
        <Field.Control>
          <Input disabled={false} />
        </Field.Control>
      </Field>,
    );

    const input = screen.getByRole("textbox", { name: "Project name" });
    expect(input).toBeDisabled();
    expect(input.closest("[data-slot='field']")).toHaveAttribute("data-disabled");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("keeps a required Field authoritative when the child sets required to false", () => {
    render(
      <Field required>
        <Field.Label>Project name</Field.Label>
        <Field.Control>
          <Input required={false} />
        </Field.Control>
      </Field>,
    );

    const input = screen.getByRole("textbox", { name: "Project name" });
    expect(input).toBeRequired();
    expect(screen.getByText("Project name")).toHaveTextContent("Project name *");
  });

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
    );

    const input = screen.getByRole("textbox", { name: "Email" });

    expectFieldDescribedBy(input, "email-help");
    expectFieldDescribedBy(input, "email-error");
    expect(input).toHaveAccessibleDescription("Email is required. Use your work email.");
  });

  it("shows one helper message at a time and announces the error first", () => {
    const { rerender } = render(
      <Field>
        <Field.Label>Email</Field.Label>
        <Field.Control>
          <Input />
        </Field.Control>
        <Field.Description>Use your work email.</Field.Description>
        <Field.Error>Email is required.</Field.Error>
      </Field>,
    );

    // Valid: the description owns the helper row and the error is not rendered at all.
    expect(screen.getByText("Use your work email.")).not.toHaveClass("sr-only");
    expect(screen.queryByText("Email is required.")).not.toBeInTheDocument();

    rerender(
      <Field invalid>
        <Field.Label>Email</Field.Label>
        <Field.Control>
          <Input />
        </Field.Control>
        <Field.Description>Use your work email.</Field.Description>
        <Field.Error>Email is required.</Field.Error>
      </Field>,
    );

    // Invalid: the error takes the row, the description stays in the DOM and in the description
    // chain — assistive tech loses nothing, the field just stops growing.
    const description = screen.getByText("Use your work email.");
    expect(description).toBeInTheDocument();
    expect(description).toHaveClass("sr-only");
    const error = screen.getByText("Email is required.");
    expect(error).toHaveAttribute("role", "alert");

    const input = screen.getByRole("textbox", { name: "Email" });
    const describedBy = requireAttribute(input, "aria-describedby").split(" ");
    expect(describedBy.indexOf(error.id)).toBeLessThan(describedBy.indexOf(description.id));
  });

  it("keeps the description visible when an invalid field has no error content", () => {
    render(
      <Field invalid>
        <Field.Label>Email</Field.Label>
        <Field.Control>
          <Input />
        </Field.Control>
        <Field.Description>Use your work email.</Field.Description>
      </Field>,
    );

    expect(screen.getByText("Use your work email.")).not.toHaveClass("sr-only");
  });

  it("merges external aria-labelledby with the field label id", () => {
    render(
      <Field>
        <Field.Label>Username</Field.Label>
        <Field.Control>
          <Input aria-labelledby="external-label" />
        </Field.Control>
      </Field>,
    );

    const input = screen.getByRole("textbox");
    const labelledBy = requireAttribute(input, "aria-labelledby");
    expect(labelledBy).toContain("external-label");

    const fieldLabel = screen.getByText("Username");
    expect(labelledBy).toContain(fieldLabel.id);
  });

  it("omits aria-labelledby when Field.Label is absent", () => {
    render(
      <Field>
        <Field.Control>
          <Input />
        </Field.Control>
        <Field.Description id="username-help">Use your work email.</Field.Description>
      </Field>,
    );

    const input = screen.getByRole("textbox");

    expect(input).not.toHaveAttribute("aria-labelledby");
    expectFieldDescribedBy(input, "username-help");
    expect(input).toHaveAccessibleDescription("Use your work email.");
  });

  it("keeps aria-label when direct, wrapped, and conditional labels are empty", () => {
    render(
      <>
        <Field controlId="direct-empty">
          <Field.Label>{""}</Field.Label>
          <Field.Control>
            <Input aria-label="Direct fallback" />
          </Field.Control>
        </Field>
        <Field controlId="wrapped-empty">
          <div>
            <Field.Label>{null}</Field.Label>
          </div>
          <Field.Control>
            <Input aria-label="Wrapped fallback" />
          </Field.Control>
        </Field>
        <Field controlId="conditional-empty">
          <Field.Label>{false && "Conditional label"}</Field.Label>
          <Field.Control>
            <Input aria-label="Conditional fallback" />
          </Field.Control>
        </Field>
      </>,
    );

    for (const name of ["Direct fallback", "Wrapped fallback", "Conditional fallback"]) {
      expect(screen.getByRole("textbox", { name })).not.toHaveAttribute("aria-labelledby");
    }
  });

  it("updates wrapped label ownership across empty, text, and empty renders", () => {
    const renderField = (label: string) => (
      <Field controlId="dynamic-label">
        <div>
          <Field.Label>{label}</Field.Label>
        </div>
        <Field.Control>
          <Input aria-label="Fallback name" />
        </Field.Control>
      </Field>
    );
    const { rerender } = render(renderField(""));

    expect(screen.getByRole("textbox", { name: "Fallback name" })).not.toHaveAttribute(
      "aria-labelledby",
    );

    rerender(renderField("Visible name"));

    const namedInput = screen.getByRole("textbox", { name: "Visible name" });
    expect(namedInput).toHaveAttribute("aria-labelledby", "dynamic-label-label");

    rerender(renderField(""));

    expect(screen.getByRole("textbox", { name: "Fallback name" })).not.toHaveAttribute(
      "aria-labelledby",
    );
  });

  it("keeps ARIA wiring when slots are wrapped in layout elements", () => {
    render(
      <Field invalid required>
        <div>
          <Field.Label>Email</Field.Label>
        </div>
        <Field.Control>
          <Input />
        </Field.Control>
        <div>
          <Field.Description>Use your work email.</Field.Description>
        </div>
        <div>
          <Field.Error>Email is required.</Field.Error>
        </div>
      </Field>,
    );

    const input = screen.getByRole("textbox", { name: "Email" });

    expect(input).toBeRequired();
    expectFieldInvalid(input, "Email is required. Use your work email.");
  });

  it("lets a control child's own id win and follows it from the label", async () => {
    const user = userEvent.setup();

    render(
      <Field controlId="field-default">
        <Field.Label>Project name</Field.Label>
        <Field.Control>
          <Input id="custom" />
        </Field.Control>
      </Field>,
    );

    const input = screen.getByRole("textbox", { name: "Project name" });
    expect(input).toHaveAttribute("id", "custom");

    const label = screen.getByText("Project name");
    expect(label).toHaveAttribute("for", "custom");

    await user.click(label);
    expect(input).toHaveFocus();
  });

  it("reverts the label htmlFor to the field default when the control child id is removed", () => {
    const { rerender } = render(
      <Field controlId="field-default">
        <Field.Label>Project name</Field.Label>
        <Field.Control>
          <Input id="custom" />
        </Field.Control>
      </Field>,
    );

    expect(screen.getByText("Project name")).toHaveAttribute("for", "custom");

    rerender(
      <Field controlId="field-default">
        <Field.Label>Project name</Field.Label>
        <Field.Control>
          <Input />
        </Field.Control>
      </Field>,
    );

    const input = screen.getByRole("textbox", { name: "Project name" });
    expect(input).toHaveAttribute("id", "field-default");
    expect(screen.getByText("Project name")).toHaveAttribute("for", "field-default");
  });

  it("resets the label htmlFor when a wrapped control with its own id unmounts", () => {
    const renderField = (showControl: boolean) => (
      <Field controlId="field-default">
        <Field.Label>Project name</Field.Label>
        <div>
          {showControl && (
            <Field.Control>
              <Input id="custom" />
            </Field.Control>
          )}
        </div>
      </Field>
    );
    const { rerender } = render(renderField(true));

    expect(screen.getByText("Project name")).toHaveAttribute("for", "custom");

    rerender(renderField(false));

    expect(screen.getByText("Project name")).toHaveAttribute("for", "field-default");
  });

  it("keeps a wrapped control's own id registered under StrictMode", () => {
    render(
      <StrictMode>
        <Field controlId="field-default">
          <Field.Label>Project name</Field.Label>
          <div>
            <Field.Control>
              <Input id="custom" />
            </Field.Control>
          </div>
        </Field>
      </StrictMode>,
    );

    expect(screen.getByRole("textbox", { name: "Project name" })).toHaveAttribute("id", "custom");
    expect(screen.getByText("Project name")).toHaveAttribute("for", "custom");
  });

  it("renders Field.Error only while invalid and joins it into aria-describedby on transition", () => {
    const { rerender } = render(
      <Field>
        <Field.Label>Email</Field.Label>
        <Field.Control>
          <Input />
        </Field.Control>
        <Field.Error>Email is required.</Field.Error>
      </Field>,
    );

    expect(screen.queryByText("Email is required.")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Email" })).not.toHaveAttribute("aria-describedby");

    rerender(
      <Field invalid>
        <Field.Label>Email</Field.Label>
        <Field.Control>
          <Input />
        </Field.Control>
        <Field.Error>Email is required.</Field.Error>
      </Field>,
    );

    const input = screen.getByRole("textbox", { name: "Email" });
    expect(screen.getByText("Email is required.")).toBeInTheDocument();
    expectFieldInvalid(input, "Email is required.");
  });

  it("treats empty string description and error as absent (no aria-describedby, no rendered text)", () => {
    render(
      <Field invalid>
        <Field.Label>Email</Field.Label>
        <Field.Control>
          <Input />
        </Field.Control>
        <Field.Description>{""}</Field.Description>
        <Field.Error>{""}</Field.Error>
      </Field>,
    );

    const input = screen.getByRole("textbox", { name: "Email" });

    expect(input).not.toHaveAttribute("aria-describedby");
    expect(input).toHaveAccessibleDescription("");
    expect(
      screen.queryByText("", { selector: "[data-slot='field-description']" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("", { selector: "[data-slot='field-error']" }),
    ).not.toBeInTheDocument();
  });

  it("treats arrays of only empty strings as absent", () => {
    render(
      <Field invalid>
        <Field.Label>Email</Field.Label>
        <Field.Control>
          <Input />
        </Field.Control>
        <Field.Description>{[""]}</Field.Description>
        <Field.Error>{["", ""]}</Field.Error>
      </Field>,
    );

    const input = screen.getByRole("textbox", { name: "Email" });

    expect(input).not.toHaveAttribute("aria-describedby");
    expect(input).toHaveAccessibleDescription("");
  });

  it("renders description when content is the number zero", () => {
    render(
      <Field>
        <Field.Label>Count</Field.Label>
        <Field.Control>
          <Input />
        </Field.Control>
        <Field.Description>{0}</Field.Description>
      </Field>,
    );

    const input = screen.getByRole("textbox", { name: "Count" });

    expect(input).toHaveAccessibleDescription("0");
  });

  it("renders description for fragments with content", () => {
    render(
      <Field>
        <Field.Label>Email</Field.Label>
        <Field.Control>
          <Input />
        </Field.Control>
        <Field.Description>
          Use your <strong>work</strong> email.
        </Field.Description>
      </Field>,
    );

    const input = screen.getByRole("textbox", { name: "Email" });

    expect(input).toHaveAccessibleDescription("Use your work email.");
  });

  it("omits aria-describedby when FieldDescription is not rendered", () => {
    render(
      <Field>
        <Field.Label>Username</Field.Label>
        <Field.Control>
          <Input />
        </Field.Control>
      </Field>,
    );

    const input = screen.getByRole("textbox", { name: "Username" });

    expect(input).not.toHaveAttribute("aria-describedby");
  });

  it("FieldError has role='alert' for live-region semantics", () => {
    render(
      <Field invalid>
        <Field.Label>Email</Field.Label>
        <Field.Control>
          <Input />
        </Field.Control>
        <Field.Error>Email is required.</Field.Error>
      </Field>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Email is required.");
  });

  it("has no a11y violations across Field configurations", async () => {
    const { container, rerender } = render(
      <Field>
        <Field.Label>Project name</Field.Label>
        <Field.Control>
          <Input />
        </Field.Control>
        <Field.Description>Use a short, memorable name.</Field.Description>
      </Field>,
    );
    expect(await axe(container)).toHaveNoViolations();

    rerender(
      <Field invalid required>
        <Field.Label>Email</Field.Label>
        <Field.Control>
          <Input />
        </Field.Control>
        <Field.Description>Use your work email.</Field.Description>
        <Field.Error>Email is required.</Field.Error>
      </Field>,
    );
    expect(await axe(container)).toHaveNoViolations();

    rerender(
      <Field invalid>
        <Field.Label>Notes</Field.Label>
        <Field.Control>
          <Textarea />
        </Field.Control>
        <Field.Error>Notes are required.</Field.Error>
      </Field>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
