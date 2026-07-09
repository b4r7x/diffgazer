import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "../../../testing/axe";
import { requireAttribute } from "../../testing/assertions";
import { expectFieldDescribedBy, expectFieldInvalid } from "../../testing/form-behavior";
import { Checkbox } from "../checkbox/index";
import { Input, InputGroup } from "../input/index";
import { Radio } from "../radio/index";
import { Select } from "../select/index";
import { Textarea } from "../textarea/index";
import { Field } from "./index";

describe("Field", () => {
  const ssrContainers: HTMLElement[] = [];

  function mountStaticMarkup(html: string) {
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);
    ssrContainers.push(container);
    return container;
  }

  afterEach(() => {
    while (ssrContainers.length > 0) ssrContainers.pop()?.remove();
  });

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
    expectFieldInvalid(input, "Use your work email. Email is required.");
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

  it("clicking the label focuses the control", async () => {
    const user = userEvent.setup();

    render(
      <Field>
        <Field.Label>Project name</Field.Label>
        <Field.Control>
          <Input />
        </Field.Control>
      </Field>,
    );

    await user.click(screen.getByText("Project name"));

    expect(screen.getByRole("textbox", { name: "Project name" })).toHaveFocus();
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
    expect(input).toHaveAccessibleDescription("Use your work email. Email is required.");
  });

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
    );

    const input = screen.getByRole("textbox", { name: "Repository path" });

    expect(input).toHaveAttribute("id", "repository-path");
    expect(input).toBeRequired();
    expect(input).toBeDisabled();
    expectFieldInvalid(input, "Relative config path. Repository path is required.");
    expect(screen.getByText("~/")).toBeInTheDocument();
    expect(screen.getByText(".json")).toBeInTheDocument();
    expect(screen.getByText("~/")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText(".json")).toHaveAttribute("aria-hidden", "true");
  });

  it("composes form wiring with textareas", () => {
    render(
      <Field invalid>
        <Field.Label>Review notes</Field.Label>
        <Field.Control>
          <Textarea />
        </Field.Control>
        <Field.Error>Notes are required.</Field.Error>
      </Field>,
    );

    const textarea = screen.getByRole("textbox", { name: "Review notes" });

    expectFieldInvalid(textarea, "Notes are required.");
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
    expectFieldInvalid(input, "Use your work email. Email is required.");
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

  it("keeps a div-based Checkbox accessible name through a wrapper", () => {
    render(
      <Field>
        <Field.Label>Accept terms</Field.Label>
        <Field.Control>
          <Checkbox />
        </Field.Control>
      </Field>,
    );

    expect(screen.getByRole("checkbox", { name: "Accept terms" })).toBeInTheDocument();
  });

  it("clicking a Field.Label toggles and focuses a div-based Checkbox", async () => {
    const user = userEvent.setup();

    render(
      <Field>
        <Field.Label>Accept terms</Field.Label>
        <Field.Control>
          <Checkbox />
        </Field.Control>
      </Field>,
    );

    const checkbox = screen.getByRole("checkbox", { name: "Accept terms" });
    expect(checkbox).toHaveAttribute("aria-checked", "false");

    await user.click(screen.getByText("Accept terms"));

    expect(checkbox).toHaveAttribute("aria-checked", "true");
    expect(checkbox).toHaveFocus();
  });

  it("clicking a label for a native Input focuses it exactly once (no double activation)", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <Field>
        <Field.Label>Project name</Field.Label>
        <Field.Control>
          <Input onChange={onChange} />
        </Field.Control>
      </Field>,
    );

    await user.click(screen.getByText("Project name"));

    expect(screen.getByRole("textbox", { name: "Project name" })).toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();
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
    );

    const combobox = screen.getByRole("combobox", { name: "Region" });

    expectFieldInvalid(combobox, "Choose where data is stored. Region is required.");
    expect(combobox).toHaveAttribute("aria-required", "true");
    expect(combobox).toBeDisabled();
    expect(combobox).toHaveAttribute("aria-labelledby");
    expect(combobox).not.toHaveAttribute("aria-label", "Select");
  });

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
    );

    const combobox = screen.getByRole("combobox", { name: "Region" });
    expect(combobox).toHaveAttribute("id", "region-select");
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

  it("has aria-labelledby on the control during initial render (not after effect)", () => {
    render(
      <Field>
        <Field.Label>Username</Field.Label>
        <Field.Control>
          <Input />
        </Field.Control>
      </Field>,
    );

    const input = screen.getByRole("textbox", { name: "Username" });
    const fieldLabel = screen.getByText("Username");

    expect(input).toHaveAttribute("aria-labelledby", fieldLabel.id);
  });

  it("wires native label and aria-labelledby to the control in SSR output before hydration", () => {
    const html = renderToStaticMarkup(
      <Field controlId="ssr-test">
        <Field.Label>Username</Field.Label>
        <Field.Control>
          <Input />
        </Field.Control>
      </Field>,
    );
    mountStaticMarkup(html);

    const input = screen.getByRole("textbox", { name: "Username" });
    expect(input).toHaveAttribute("id", "ssr-test");
    expect(input).toHaveAttribute("aria-labelledby", "ssr-test-label");
    expect(screen.getByText("Username")).toHaveAttribute("for", "ssr-test");
  });

  it("names a div-based Checkbox via aria-labelledby in SSR output before hydration", () => {
    const html = renderToStaticMarkup(
      <Field controlId="accept">
        <Field.Label>Accept terms</Field.Label>
        <Field.Control>
          <Checkbox />
        </Field.Control>
      </Field>,
    );
    mountStaticMarkup(html);

    expect(screen.getByRole("checkbox", { name: "Accept terms" })).toBeInTheDocument();
  });

  it("names a div-based Radio via aria-labelledby in SSR output before hydration", () => {
    const html = renderToStaticMarkup(
      <Field controlId="plan">
        <Field.Label>Pro plan</Field.Label>
        <Field.Control>
          <Radio />
        </Field.Control>
      </Field>,
    );
    mountStaticMarkup(html);

    expect(screen.getByRole("radio", { name: "Pro plan" })).toBeInTheDocument();
  });

  it("wires aria-describedby to the control in SSR output for description and error", () => {
    const html = renderToStaticMarkup(
      <Field invalid controlId="email">
        <Field.Label>Email</Field.Label>
        <Field.Control>
          <Input />
        </Field.Control>
        <Field.Description>Use your work email.</Field.Description>
        <Field.Error>Email is required.</Field.Error>
      </Field>,
    );
    mountStaticMarkup(html);

    const input = screen.getByRole("textbox", { name: "Email" });
    expect(input).toHaveAccessibleDescription("Use your work email. Email is required.");
  });

  it("follows a child control's own id from the label in SSR output before hydration", () => {
    const html = renderToStaticMarkup(
      <Field controlId="field-default">
        <Field.Label>Project name</Field.Label>
        <Field.Control>
          <Input id="custom" />
        </Field.Control>
      </Field>,
    );
    mountStaticMarkup(html);

    const input = screen.getByRole("textbox", { name: "Project name" });
    expect(input).toHaveAttribute("id", "custom");
    expect(screen.getByText("Project name")).toHaveAttribute("for", "custom");
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
