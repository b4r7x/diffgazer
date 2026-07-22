import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FormEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { Checkbox } from "../ui/checkbox/index";
import { Radio, RadioGroup } from "../ui/radio/index";
import { Select } from "../ui/select/index";
import { Switch } from "../ui/switch/index";
import { ToggleGroup } from "../ui/toggle-group/index";

function getForm(name = "Test form"): HTMLFormElement {
  const form = screen.getByRole("form", { name });
  if (!(form instanceof HTMLFormElement)) throw new Error("Expected form test element");
  return form;
}

function captureSubmissions(submissions: FormData[]) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submissions.push(new FormData(event.currentTarget));
  };
}

async function resetThenSubmit(
  form: HTMLFormElement,
  expected: ReadonlyArray<readonly [string, string]>,
): Promise<void> {
  form.reset();
  expect(form).toBeValid();
  expect([...new FormData(form).entries()]).toEqual(expected);
  // fireEvent retained: userEvent has no direct submit API, and this fixture has no submit control.
  fireEvent.submit(form);
  await Promise.resolve();
}

describe("fieldset disabling", () => {
  it("tracks disabled fieldsets for standalone and grouped checkbox and radio controls", async () => {
    const user = userEvent.setup();
    const onCheckboxChange = vi.fn();
    const onCheckboxGroupChange = vi.fn();
    const onRadioChange = vi.fn();
    const onRadioGroupChange = vi.fn();

    function Fixture({ disabled }: { disabled: boolean }) {
      return (
        <form aria-label="Fieldset form">
          <fieldset disabled={disabled}>
            <legend>
              <Checkbox checked name="legend-check" value="yes" label="Legend checkbox" />
              <Radio checked name="legend-radio" value="yes" label="Legend radio" />
            </legend>
            <Checkbox
              checked
              name="outside-check"
              value="yes"
              label="Outside checkbox"
              onChange={onCheckboxChange}
            />
            <Checkbox.Group
              name="fruits"
              value={["apple"]}
              onChange={onCheckboxGroupChange}
              label="Fruits"
            >
              <Checkbox.Item value="apple" label="Apple" />
              <Checkbox.Item value="banana" label="Banana" />
            </Checkbox.Group>
            <Radio
              checked
              name="outside-radio"
              value="yes"
              label="Outside radio"
              onChange={onRadioChange}
            />
            <RadioGroup name="colors" value="red" onChange={onRadioGroupChange} label="Colors">
              <RadioGroup.Item value="red" label="Red" />
              <RadioGroup.Item value="blue" label="Blue" />
            </RadioGroup>
          </fieldset>
        </form>
      );
    }

    const { rerender } = render(<Fixture disabled />);
    const form = getForm("Fieldset form");
    const outsideControls = [
      screen.getByRole("checkbox", { name: "Outside checkbox" }),
      screen.getByRole("checkbox", { name: "Apple" }),
      screen.getByRole("radio", { name: "Outside radio" }),
      screen.getByRole("radio", { name: "Red" }),
    ];

    for (const control of outsideControls) {
      expect(control).toHaveAttribute("aria-disabled", "true");
      expect(control).toHaveAttribute("tabindex", "-1");
      await user.click(control);
    }
    expect(onCheckboxChange).not.toHaveBeenCalled();
    expect(onCheckboxGroupChange).not.toHaveBeenCalled();
    expect(onRadioChange).not.toHaveBeenCalled();
    expect(onRadioGroupChange).not.toHaveBeenCalled();

    outsideControls[1]?.focus();
    await user.keyboard("{ArrowDown}{Enter} ");
    expect(screen.getByRole("checkbox", { name: "Apple" })).toHaveFocus();
    outsideControls[3]?.focus();
    await user.keyboard("{ArrowDown} ");
    expect(screen.getByRole("radio", { name: "Red" })).toHaveFocus();
    expect(onCheckboxGroupChange).not.toHaveBeenCalled();
    expect(onRadioGroupChange).not.toHaveBeenCalled();
    expect([...new FormData(form).entries()]).toEqual([
      ["legend-check", "yes"],
      ["legend-radio", "yes"],
    ]);
    expect(screen.getByRole("checkbox", { name: "Legend checkbox" })).not.toHaveAttribute(
      "aria-disabled",
    );
    expect(screen.getByRole("radio", { name: "Legend radio" })).not.toHaveAttribute(
      "aria-disabled",
    );

    rerender(<Fixture disabled={false} />);

    await waitFor(() => {
      for (const control of outsideControls) expect(control).not.toHaveAttribute("aria-disabled");
    });
    expect([...new FormData(form).entries()]).toEqual([
      ["legend-check", "yes"],
      ["legend-radio", "yes"],
      ["outside-check", "yes"],
      ["fruits", "apple"],
      ["outside-radio", "yes"],
      ["colors", "red"],
    ]);
  });
});

describe("controlled form mirrors after reset", () => {
  it("submits the current controlled Checkbox value", async () => {
    const submissions: FormData[] = [];
    const onSubmit = captureSubmissions(submissions);
    const onChange = vi.fn();
    const { rerender } = render(
      <form aria-label="Test form" onSubmit={onSubmit}>
        <Checkbox name="choice" value="yes" checked={false} onChange={onChange} label="Yes" />
      </form>,
    );
    rerender(
      <form aria-label="Test form" onSubmit={onSubmit}>
        <Checkbox name="choice" value="yes" checked onChange={onChange} label="Yes" />
      </form>,
    );

    await resetThenSubmit(getForm(), [["choice", "yes"]]);

    expect(submissions.at(-1)?.get("choice")).toBe("yes");
    expect(screen.getByRole("checkbox", { name: "Yes" })).toHaveAttribute("aria-checked", "true");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("submits the current controlled Switch value", async () => {
    const submissions: FormData[] = [];
    const onSubmit = captureSubmissions(submissions);
    const onChange = vi.fn();
    const { rerender } = render(
      <form aria-label="Test form" onSubmit={onSubmit}>
        <Switch
          name="enabled"
          value="yes"
          checked={false}
          onChange={onChange}
          aria-label="Enabled"
        />
      </form>,
    );
    rerender(
      <form aria-label="Test form" onSubmit={onSubmit}>
        <Switch name="enabled" value="yes" checked onChange={onChange} aria-label="Enabled" />
      </form>,
    );

    await resetThenSubmit(getForm(), [["enabled", "yes"]]);

    expect(submissions.at(-1)?.get("enabled")).toBe("yes");
    expect(screen.getByRole("switch", { name: "Enabled" })).toHaveAttribute("aria-checked", "true");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("submits the current controlled standalone Radio value", async () => {
    const submissions: FormData[] = [];
    const onSubmit = captureSubmissions(submissions);
    const onChange = vi.fn();
    const { rerender } = render(
      <form aria-label="Test form" onSubmit={onSubmit}>
        <Radio name="choice" value="yes" checked={false} onChange={onChange} label="Yes" />
      </form>,
    );
    rerender(
      <form aria-label="Test form" onSubmit={onSubmit}>
        <Radio name="choice" value="yes" checked onChange={onChange} label="Yes" />
      </form>,
    );

    await resetThenSubmit(getForm(), [["choice", "yes"]]);

    expect(submissions.at(-1)?.get("choice")).toBe("yes");
    expect(screen.getByRole("radio", { name: "Yes" })).toHaveAttribute("aria-checked", "true");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("submits the current controlled CheckboxGroup values", async () => {
    const submissions: FormData[] = [];
    const onSubmit = captureSubmissions(submissions);
    const onChange = vi.fn();
    const renderForm = (value: string[]) => (
      <form aria-label="Test form" onSubmit={onSubmit}>
        <Checkbox.Group name="fruits" value={value} onChange={onChange} label="Fruits">
          <Checkbox.Item value="apple" label="Apple" />
          <Checkbox.Item value="banana" label="Banana" />
        </Checkbox.Group>
      </form>
    );
    const { rerender } = render(renderForm([]));
    rerender(renderForm(["banana"]));

    await resetThenSubmit(getForm(), [["fruits", "banana"]]);

    expect(submissions.at(-1)?.getAll("fruits")).toEqual(["banana"]);
    expect(screen.getByRole("checkbox", { name: "Banana" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it("submits the current controlled RadioGroup value", async () => {
    const submissions: FormData[] = [];
    const onSubmit = captureSubmissions(submissions);
    const onChange = vi.fn();
    const renderForm = (value: string) => (
      <form aria-label="Test form" onSubmit={onSubmit}>
        <RadioGroup name="color" value={value} onChange={onChange} label="Color">
          <RadioGroup.Item value="red" label="Red" />
          <RadioGroup.Item value="blue" label="Blue" />
        </RadioGroup>
      </form>
    );
    const { rerender } = render(renderForm("red"));
    rerender(renderForm("blue"));

    await resetThenSubmit(getForm(), [["color", "blue"]]);

    expect(submissions.at(-1)?.get("color")).toBe("blue");
    expect(screen.getByRole("radio", { name: "Blue" })).toHaveAttribute("aria-checked", "true");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("keeps a controlled unnamed required RadioGroup valid after reset", async () => {
    const submissions: FormData[] = [];
    const onSubmit = captureSubmissions(submissions);
    const onChange = vi.fn();
    const renderForm = (value: string | undefined) => (
      <form aria-label="Test form" onSubmit={onSubmit}>
        <RadioGroup required value={value} onChange={onChange} label="Color">
          <RadioGroup.Item value="red" label="Red" />
          <RadioGroup.Item value="blue" label="Blue" />
        </RadioGroup>
      </form>
    );
    const { rerender } = render(renderForm(undefined));
    rerender(renderForm("blue"));

    await resetThenSubmit(getForm(), []);

    expect(submissions).toHaveLength(1);
    expect(screen.getByRole("radio", { name: "Blue" })).toHaveAttribute("aria-checked", "true");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("submits the current controlled Select value", async () => {
    const submissions: FormData[] = [];
    const onSubmit = captureSubmissions(submissions);
    const onChange = vi.fn();
    const renderForm = (value: string) => (
      <form aria-label="Test form" onSubmit={onSubmit}>
        <Select name="fruit" value={value} onChange={onChange}>
          <Select.Trigger aria-label="Fruit">
            <Select.Value />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="apple">Apple</Select.Item>
            <Select.Item value="banana">Banana</Select.Item>
          </Select.Content>
        </Select>
      </form>
    );
    const { rerender } = render(renderForm("apple"));
    rerender(renderForm("banana"));

    await resetThenSubmit(getForm(), [["fruit", "banana"]]);

    expect(submissions.at(-1)?.get("fruit")).toBe("banana");
    expect(screen.getByRole("combobox", { name: "Fruit" })).toHaveTextContent("Banana");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("leaves ToggleGroup's type=hidden mirror current without reset repair", async () => {
    const submissions: FormData[] = [];
    const onSubmit = captureSubmissions(submissions);
    const onChange = vi.fn();
    const renderForm = (value: string) => (
      <form aria-label="Test form" onSubmit={onSubmit}>
        <ToggleGroup name="view" value={value} onChange={onChange} label="View">
          <ToggleGroup.Item value="list">List</ToggleGroup.Item>
          <ToggleGroup.Item value="grid">Grid</ToggleGroup.Item>
        </ToggleGroup>
      </form>
    );
    const { rerender } = render(renderForm("list"));
    rerender(renderForm("grid"));

    await resetThenSubmit(getForm(), [["view", "grid"]]);

    expect(submissions.at(-1)?.get("view")).toBe("grid");
    expect(onChange).not.toHaveBeenCalled();
  });
});
