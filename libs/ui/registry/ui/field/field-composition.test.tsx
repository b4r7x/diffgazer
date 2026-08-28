import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "../../../testing/axe";
import { expectFieldInvalid } from "../../testing/form-behavior";
import { Checkbox } from "../checkbox/index";
import { Input, InputGroup } from "../input/index";
import { Radio } from "../radio/index";
import { Select } from "../select/index";
import { Textarea } from "../textarea/index";
import { Field } from "./index";

describe("Field composed with controls", () => {
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
    expectFieldInvalid(input, "Repository path is required. Relative config path.");
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

  it("does not activate a div-based Checkbox disabled by Field", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <Field disabled>
        <Field.Label>Accept terms</Field.Label>
        <Field.Control>
          <Checkbox onChange={onChange} />
        </Field.Control>
      </Field>,
    );

    const checkbox = screen.getByRole("checkbox", { name: "Accept terms" });
    await user.click(screen.getByText("Accept terms"));

    expect(checkbox).toHaveAttribute("aria-disabled", "true");
    expect(checkbox).toHaveAttribute("aria-checked", "false");
    expect(checkbox).not.toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not activate a disabled div-based Radio", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <Field>
        <Field.Label>Primary option</Field.Label>
        <Field.Control>
          <Radio disabled onChange={onChange} />
        </Field.Control>
      </Field>,
    );

    const radio = screen.getByRole("radio", { name: "Primary option" });
    await user.click(screen.getByText("Primary option"));

    expect(radio).toHaveAttribute("aria-disabled", "true");
    expect(radio).toHaveAttribute("aria-checked", "false");
    expect(radio).not.toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();
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

    expectFieldInvalid(combobox, "Region is required. Choose where data is stored.");
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
});

describe("Field composition accessibility", () => {
  it("has no a11y violations across the decorated and non-native controls", async () => {
    const { container } = render(
      <>
        <Field controlId="composed-input">
          <Field.Label>Repository path</Field.Label>
          <Field.Control>
            <InputGroup prefix="~/" suffix=".json" />
          </Field.Control>
          <Field.Description>Relative config path.</Field.Description>
        </Field>
        <Field controlId="composed-checkbox">
          <Field.Label>Include drafts</Field.Label>
          <Field.Control>
            <Checkbox value="drafts" />
          </Field.Control>
        </Field>
        <Field controlId="composed-textarea" invalid>
          <Field.Label>Notes</Field.Label>
          <Field.Control>
            <Textarea />
          </Field.Control>
          <Field.Error>Notes are required.</Field.Error>
        </Field>
      </>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
