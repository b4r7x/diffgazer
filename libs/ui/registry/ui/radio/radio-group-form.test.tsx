import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { expectFieldInvalid, expectResetClearsInvalid } from "../../testing/form-behavior";
import { RadioGroup } from "./index";

function getForm(): HTMLFormElement {
  const form = screen.getByRole("form", { name: "Test form" });
  if (!(form instanceof HTMLFormElement)) throw new Error("Expected form test element");
  return form;
}

describe("RadioGroup form behavior", () => {
  it("submits the item value when its DOM id is different", () => {
    render(
      <form aria-label="Test form">
        <RadioGroup name="color" defaultValue="ocean" label="Colors">
          <RadioGroup.Item id="blue-control" value="ocean" label="Blue" />
          <RadioGroup.Item id="red-control" value="sunset" label="Red" />
        </RadioGroup>
      </form>,
    );

    expect(screen.getByRole("radio", { name: "Blue" })).toHaveAttribute("id", "blue-control");
    expect(new FormData(getForm()).get("color")).toBe("ocean");
  });

  it("resets uncontrolled group value with native form reset", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <form aria-label="Test form">
        <RadioGroup name="color" defaultValue="red" onChange={onChange} label="Colors">
          <RadioGroup.Item value="red" label="Red" />
          <RadioGroup.Item value="blue" label="Blue" />
        </RadioGroup>
      </form>,
    );

    await user.click(screen.getByRole("radio", { name: /blue/i }));
    const form = getForm();
    expect(new FormData(form).get("color")).toBe("blue");
    expect(onChange).toHaveBeenCalledOnce();

    form.reset();
    await waitFor(() => expect(new FormData(form).get("color")).toBe("red"));
    expect(onChange).toHaveBeenCalledOnce();
  });

  it("keeps a RadioGroup activation newer than a same-task form reset", async () => {
    render(
      <form aria-label="Test form">
        <RadioGroup name="color" defaultValue="red" label="Colors">
          <RadioGroup.Item value="red" label="Red" />
          <RadioGroup.Item value="blue" label="Blue" />
        </RadioGroup>
      </form>,
    );
    const form = getForm();

    form.reset();
    // fireEvent retained: activation must remain in the reset task before its microtask can flush.
    fireEvent.click(screen.getByRole("radio", { name: /blue/i }));
    await Promise.resolve();

    expect(new FormData(form).get("color")).toBe("blue");
  });

  it("applies a RadioGroup reset before a later activation", async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Test form">
        <RadioGroup name="color" defaultValue="red" label="Colors">
          <RadioGroup.Item value="red" label="Red" />
          <RadioGroup.Item value="blue" label="Blue" />
        </RadioGroup>
      </form>,
    );
    const blue = screen.getByRole("radio", { name: /blue/i });
    const form = getForm();

    await user.click(blue);
    expect(new FormData(form).get("color")).toBe("blue");

    form.reset();
    await waitFor(() => expect(new FormData(form).get("color")).toBe("red"));
    expect(blue).toHaveAttribute("aria-checked", "false");

    await user.click(blue);
    expect(blue).toHaveAttribute("aria-checked", "true");
    expect(new FormData(form).get("color")).toBe("blue");
  });

  it("clears the group's aria-invalid on native form reset after a failed submit", async () => {
    render(
      <form aria-label="Test form">
        <RadioGroup name="color" required label="Colors">
          <RadioGroup.Item value="red" label="Red" />
          <RadioGroup.Item value="blue" label="Blue" />
        </RadioGroup>
      </form>,
    );

    await expectResetClearsInvalid(getForm(), screen.getByRole("radiogroup", { name: "Colors" }));
  });

  it("marks required groups and routes native validation to a visible radio", async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Test form">
        <RadioGroup name="color" required label="Colors">
          <RadioGroup.Item value="red" label="Red" />
          <RadioGroup.Item value="blue" label="Blue" />
        </RadioGroup>
      </form>,
    );

    expect(screen.getByRole("radiogroup")).toHaveAttribute("aria-required", "true");
    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).not.toHaveAttribute("aria-required");
    }
    expect(screen.getAllByRole("radio")).toHaveLength(2);

    const form = getForm();
    expect(form.reportValidity()).toBe(false);
    expect(screen.getByRole("radio", { name: /red/i })).toHaveFocus();
    await waitFor(() => expectFieldInvalid(screen.getByRole("radiogroup")));
    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).not.toHaveAttribute("aria-invalid");
    }

    await user.click(screen.getByRole("radio", { name: /blue/i }));
    expect(form.checkValidity()).toBe(true);
    expect(screen.getByRole("radiogroup")).not.toHaveAttribute("aria-invalid");
    expect(new FormData(form).get("color")).toBe("blue");
  });

  it("does not satisfy required validation with a stale controlled value", async () => {
    render(
      <form aria-label="Test form">
        <RadioGroup name="color" required label="Colors" value="missing">
          <RadioGroup.Item value="red" label="Red" />
          <RadioGroup.Item value="blue" label="Blue" />
        </RadioGroup>
      </form>,
    );

    const form = getForm();
    expect(form.checkValidity()).toBe(false);
    expect(new FormData(form).has("color")).toBe(false);

    expect(form.reportValidity()).toBe(false);
    expect(screen.getByRole("radio", { name: /red/i })).toHaveFocus();
    await waitFor(() => expectFieldInvalid(screen.getByRole("radiogroup")));
  });

  it("validates required groups with items rendered through wrapper components", () => {
    function WrappedBlue() {
      return <RadioGroup.Item value="blue" label="Blue" />;
    }

    render(
      <form aria-label="Test form">
        <RadioGroup name="color" required label="Colors" value="blue">
          <WrappedBlue />
        </RadioGroup>
      </form>,
    );

    const form = getForm();
    expect(form.checkValidity()).toBe(true);
    expect(new FormData(form).get("color")).toBe("blue");
  });

  it("validates required unnamed groups without contributing FormData", async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Test form">
        <RadioGroup required label="Colors">
          <RadioGroup.Item value="red" label="Red" />
          <RadioGroup.Item value="blue" label="Blue" />
        </RadioGroup>
      </form>,
    );

    const form = getForm();
    expect(form.reportValidity()).toBe(false);
    expect(screen.getByRole("radio", { name: /red/i })).toHaveFocus();
    await waitFor(() => expectFieldInvalid(screen.getByRole("radiogroup")));
    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).not.toHaveAttribute("aria-invalid");
    }
    expect(new FormData(form).entries().next().done).toBe(true);

    await user.click(screen.getByRole("radio", { name: /blue/i }));
    expect(form.checkValidity()).toBe(true);
    expect(screen.getByRole("radiogroup")).not.toHaveAttribute("aria-invalid");
    expect(new FormData(form).entries().next().done).toBe(true);
  });

  it.each([
    { label: "named", name: "color" },
    { label: "unnamed", name: undefined },
  ])("exempts an all-disabled $label required group from validation", async ({ name }) => {
    function RequiredGroup({ allDisabled }: { allDisabled: boolean }) {
      return (
        <form aria-label="Test form">
          <button type="button">Before group</button>
          <RadioGroup {...(name ? { name } : {})} required label="Colors">
            <RadioGroup.Item value="red" label="Red" disabled={allDisabled} />
            <RadioGroup.Item value="blue" label="Blue" disabled={allDisabled} />
          </RadioGroup>
        </form>
      );
    }

    const { rerender } = render(<RequiredGroup allDisabled={false} />);
    const form = getForm();
    const group = screen.getByRole("radiogroup", { name: "Colors" });
    expect(form.reportValidity()).toBe(false);
    await waitFor(() => expectFieldInvalid(group));

    rerender(<RequiredGroup allDisabled />);

    await waitFor(() => expect(group).not.toHaveAttribute("aria-required"));
    expect(group).not.toHaveAttribute("aria-invalid");
    expect(form.checkValidity()).toBe(true);
    expect(new FormData(form).has("color")).toBe(false);
    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).toHaveAttribute("aria-disabled", "true");
      expect(radio).toHaveAttribute("tabindex", "-1");
    }

    const before = screen.getByRole("button", { name: "Before group" });
    before.focus();
    expect(form.reportValidity()).toBe(true);
    expect(before).toHaveFocus();
  });

  it("does not call the public value callback with undefined on native reset", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <form aria-label="Test form">
        <RadioGroup name="color" onChange={onChange} label="Colors">
          <RadioGroup.Item value="red" label="Red" />
          <RadioGroup.Item value="blue" label="Blue" />
        </RadioGroup>
      </form>,
    );

    await user.click(screen.getByRole("radio", { name: /blue/i }));
    expect(onChange).toHaveBeenCalledWith("blue");

    const form = getForm();
    form.reset();

    await waitFor(() =>
      expect(screen.getByRole("radio", { name: /blue/i })).toHaveAttribute("aria-checked", "false"),
    );
    // call-count IS the contract: native form reset must NOT fire onChange (count stays at 1 from the explicit click; a reset-triggered onChange with undefined would be a regression)
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
