import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "../../../testing/axe";
import { expectFieldInvalid } from "../../testing/form-behavior";
import { Field } from "../field/index";
import { RadioGroup } from "./index";

describe("RadioGroup", () => {
  it("keeps the visible label and the radiogroup in one stacking root", () => {
    render(
      <RadioGroup label="Colors" defaultValue="blue">
        <RadioGroup.Item value="blue" label="Blue" />
        <RadioGroup.Item value="green" label="Green" />
      </RadioGroup>,
    );
    const group = screen.getByRole("radiogroup", { name: "Colors" });
    const groupLabel = screen.getByText("Colors");

    expect(groupLabel.parentElement).toBe(group.parentElement);
    expect(group.parentElement).toHaveAttribute("data-slot", "radio-group-root");
  });

  it("supports direct namespaced items with custom label UI", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RadioGroup onChange={onChange} label="Colors">
        <RadioGroup.Item value="red" label={<span>Red</span>} description={<span>Warm</span>} />
        <RadioGroup.Item value="blue" label={<span>Blue</span>} />
      </RadioGroup>,
    );

    await user.click(screen.getByRole("radio", { name: /blue/i }));

    expect(onChange).toHaveBeenCalledWith("blue");
    expect(screen.getByText("Warm")).toBeInTheDocument();
  });

  it("selects a value on click", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RadioGroup onChange={onChange} label="Colors">
        <RadioGroup.Item value="red" label="Red" />
        <RadioGroup.Item value="blue" label="Blue" />
      </RadioGroup>,
    );
    await user.click(screen.getByText("Blue"));
    expect(onChange).toHaveBeenCalledWith("blue");
  });

  it("renders the group label visibly and names the group with aria-labelledby", () => {
    render(
      <RadioGroup label="Colors">
        <RadioGroup.Item value="red" label="Red" />
      </RadioGroup>,
    );

    const label = screen.getByText("Colors");
    const group = screen.getByRole("radiogroup", { name: "Colors" });
    expect(label).toBeVisible();
    expect(group).toHaveAttribute("aria-labelledby", label.id);
    expect(group).not.toHaveAttribute("aria-label");
  });

  it("uses an explicit aria-label instead of the visible group label", () => {
    render(
      <RadioGroup label="Visible colors" aria-label="Color choices">
        <RadioGroup.Item value="red" label="Red" />
      </RadioGroup>,
    );

    expect(screen.getByText("Visible colors")).toBeVisible();
    const group = screen.getByRole("radiogroup", { name: "Color choices" });
    expect(group).toHaveAttribute("aria-label", "Color choices");
    expect(group).not.toHaveAttribute("aria-labelledby");
    expect(screen.queryByRole("radiogroup", { name: "Visible colors" })).not.toBeInTheDocument();
  });

  it("preserves Field invalid and description wiring on the group", () => {
    render(
      <Field invalid>
        <Field.Label>Colors</Field.Label>
        <Field.Control>
          <RadioGroup>
            <RadioGroup.Item value="red" label="Red" />
          </RadioGroup>
        </Field.Control>
        <Field.Error>Select a color.</Field.Error>
      </Field>,
    );

    const group = screen.getByRole("radiogroup", { name: "Colors" });
    expectFieldInvalid(group, "Select a color.");
  });

  it("does not select disabled items", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RadioGroup onChange={onChange} label="Colors">
        <RadioGroup.Item value="red" label="Red" />
        <RadioGroup.Item value="blue" label="Blue" disabled />
      </RadioGroup>,
    );
    await user.click(screen.getByText("Blue"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("respects controlled value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RadioGroup value="red" onChange={onChange} label="Colors">
        <RadioGroup.Item value="red" label="Red" />
        <RadioGroup.Item value="blue" label="Blue" />
      </RadioGroup>,
    );
    await user.click(screen.getByText("Blue"));
    expect(onChange).toHaveBeenCalledWith("blue");
    expect(screen.getAllByRole("radio")[0]).toHaveAttribute("aria-checked", "true");
    expect(screen.getAllByRole("radio")[1]).toHaveAttribute("aria-checked", "false");
  });

  it("keeps explicit value undefined controlled instead of adopting internal selection", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RadioGroup value={undefined} onChange={onChange} label="Colors">
        <RadioGroup.Item value="red" label="Red" />
        <RadioGroup.Item value="blue" label="Blue" />
      </RadioGroup>,
    );

    await user.click(screen.getByText("Blue"));

    expect(onChange).toHaveBeenCalledWith("blue");
    expect(screen.getAllByRole("radio")[0]).toHaveAttribute("aria-checked", "false");
    expect(screen.getAllByRole("radio")[1]).toHaveAttribute("aria-checked", "false");
  });

  it("has no a11y violations (unselected and selected)", async () => {
    const { container, unmount } = render(
      <RadioGroup label="Colors">
        <RadioGroup.Item value="red" label="Red" />
        <RadioGroup.Item value="blue" label="Blue" />
      </RadioGroup>,
    );
    expect(await axe(container)).toHaveNoViolations();
    unmount();

    const { container: selectedContainer } = render(
      <RadioGroup label="Colors" defaultValue="red">
        <RadioGroup.Item value="red" label="Red" />
        <RadioGroup.Item value="blue" label="Blue" />
      </RadioGroup>,
    );
    expect(screen.getByRole("radio", { name: "Red" })).toHaveAttribute("aria-checked", "true");
    expect(await axe(selectedContainer)).toHaveNoViolations();
  });

  it("uses native aria-labelledby for the group name", () => {
    render(
      <>
        <h2 id="choice-label">Choice set</h2>
        <RadioGroup aria-labelledby="choice-label">
          <RadioGroup.Item value="red" label="Red" />
          <RadioGroup.Item value="blue" label="Blue" />
        </RadioGroup>
      </>,
    );

    expect(screen.getByRole("radiogroup", { name: "Choice set" })).toHaveAttribute(
      "aria-labelledby",
      "choice-label",
    );
  });
});
