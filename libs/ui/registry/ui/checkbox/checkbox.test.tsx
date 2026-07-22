import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "../../../testing/axe";
import {
  expectFieldDescribedBy,
  expectFieldInvalid,
  expectResetClearsInvalid,
  submitForm,
} from "../../testing/form-behavior";
import { Field } from "../field/index";
import { Checkbox } from "./index";

function getForm(name = "Test form"): HTMLFormElement {
  const form = screen.getByRole("form", { name });
  if (!(form instanceof HTMLFormElement)) throw new Error("Expected form test element");
  return form;
}

describe("Checkbox", () => {
  it("toggles on click and respects controlled value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Checkbox checked={false} onChange={onChange} label="Accept terms" />);
    await user.click(screen.getByRole("checkbox"));
    expect(onChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole("checkbox")).toHaveAttribute("aria-checked", "false");
  });

  it("toggles on Space key", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Checkbox onChange={onChange} label="Accept terms" />);
    screen.getByRole("checkbox").focus();
    await user.keyboard(" ");
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("emits data-slot and data-state styling hooks", () => {
    const { rerender } = render(<Checkbox checked={false} label="Accept" />);
    const control = screen.getByRole("checkbox");
    expect(control).toHaveAttribute("data-slot", "checkbox");
    expect(control).toHaveAttribute("data-state", "unchecked");
    rerender(<Checkbox checked label="Accept" />);
    expect(control).toHaveAttribute("data-state", "checked");
    rerender(<Checkbox checked="indeterminate" label="Accept" />);
    expect(control).toHaveAttribute("data-state", "indeterminate");
    rerender(<Checkbox checked disabled label="Accept" />);
    expect(control).toHaveAttribute("data-disabled", "");
  });

  it("does not toggle when disabled via click or keyboard", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onClick = vi.fn();
    render(<Checkbox disabled onChange={onChange} onClick={onClick} label="Accept terms" />);
    const checkbox = screen.getByRole("checkbox");

    await user.click(checkbox);
    checkbox.focus();
    await user.keyboard(" ");

    expect(onChange).not.toHaveBeenCalled();
    expect(onClick).not.toHaveBeenCalled();
  });

  it("Tab moves focus away from a click-focused disabled checkbox", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Checkbox disabled label="Accept terms" />
        <button type="button">Next</button>
      </>,
    );
    const checkbox = screen.getByRole("checkbox", { name: /accept terms/i });

    await user.click(checkbox);
    checkbox.focus();
    expect(checkbox).toHaveFocus();

    const event = new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true,
    });
    checkbox.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);

    await user.tab();
    expect(screen.getByRole("button", { name: /next/i })).toHaveFocus();
  });

  it("renders indeterminate state as aria-checked mixed", () => {
    render(<Checkbox checked="indeterminate" label="Select all" />);
    expect(screen.getByRole("checkbox")).toHaveAttribute("aria-checked", "mixed");
  });

  it("provides accessible name from label or aria-label", () => {
    const { rerender } = render(<Checkbox label="Accept terms" />);
    expect(screen.getByRole("checkbox", { name: "Accept terms" })).toBeInTheDocument();

    rerender(<Checkbox aria-label="Accept terms" />);
    expect(screen.getByRole("checkbox", { name: "Accept terms" })).toBeInTheDocument();
  });

  it("links description via aria-describedby", () => {
    render(<Checkbox label="Accept" description="You must accept to proceed" />);
    const checkbox = screen.getByRole("checkbox");
    expectFieldDescribedBy(checkbox, screen.getByText("You must accept to proceed").id);
  });

  it("composes Field label and description ids with local label and description", () => {
    render(
      <Field invalid>
        <Field.Label>Accept policy</Field.Label>
        <Field.Control>
          <Checkbox label="Terms" description="Local help" />
        </Field.Control>
        <Field.Description>Field help</Field.Description>
        <Field.Error>Field error</Field.Error>
      </Field>,
    );

    const checkbox = screen.getByRole("checkbox", { name: /accept policy.*terms/i });
    expectFieldInvalid(checkbox, /field help.*field error.*local help/i);
  });

  it("renders aria-invalid and aria-required when set", () => {
    render(<Checkbox aria-invalid required label="Accept" />);
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toHaveAttribute("aria-invalid", "true");
    expect(checkbox).toHaveAttribute("aria-required", "true");
  });

  it("resets uncontrolled checked state with native form reset", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <form aria-label="Test form">
        <Checkbox name="terms" defaultChecked onChange={onChange} label="Accept terms" />
      </form>,
    );

    await user.click(screen.getByRole("checkbox"));
    const form = getForm();
    expect(new FormData(form).has("terms")).toBe(false);
    expect(onChange).toHaveBeenCalledOnce();

    form.reset();
    await waitFor(() => expect(new FormData(form).get("terms")).toBe("on"));
    await waitFor(() =>
      expect(screen.getByRole("checkbox")).toHaveAttribute("aria-checked", "true"),
    );
    expect(onChange).toHaveBeenCalledOnce();
  });

  it("keeps a checkbox activation newer than a same-task form reset", async () => {
    render(
      <form aria-label="Test form">
        <Checkbox name="terms" label="Accept terms" />
      </form>,
    );
    const checkbox = screen.getByRole("checkbox");
    const form = getForm();

    form.reset();
    // fireEvent retained: activation must remain in the reset task before its microtask can flush.
    fireEvent.click(checkbox);
    await Promise.resolve();

    expect(checkbox).toHaveAttribute("aria-checked", "true");
    expect(new FormData(form).get("terms")).toBe("on");
  });

  it("applies a checkbox reset before a later activation", async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Test form">
        <Checkbox name="terms" defaultChecked label="Accept terms" />
      </form>,
    );
    const checkbox = screen.getByRole("checkbox");
    const form = getForm();

    await user.click(checkbox);
    expect(new FormData(form).has("terms")).toBe(false);

    form.reset();
    await waitFor(() => expect(new FormData(form).get("terms")).toBe("on"));
    expect(checkbox).toHaveAttribute("aria-checked", "true");

    await user.click(checkbox);
    expect(checkbox).toHaveAttribute("aria-checked", "false");
    expect(new FormData(form).has("terms")).toBe(false);
  });

  it("focuses the visible checkbox when native required validation fails", async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Test form" onSubmit={(event) => event.preventDefault()}>
        <Checkbox name="terms" required label="Accept terms" />
        <button type="submit">Submit</button>
      </form>,
    );

    const checkbox = screen.getByRole("checkbox", { name: /accept terms/i });

    await submitForm(user);
    expect(checkbox).toHaveFocus();
    await waitFor(() => expectFieldInvalid(checkbox));
  });

  it("clears aria-invalid on native form reset after a failed submit", async () => {
    render(
      <form aria-label="Test form">
        <Checkbox name="terms" required label="Accept terms" />
      </form>,
    );

    await expectResetClearsInvalid(
      getForm(),
      screen.getByRole("checkbox", { name: /accept terms/i }),
    );
  });

  it("keeps the hidden form-mirror input out of the a11y tree with no aria-label", () => {
    const { container } = render(<Checkbox name="terms" required label="Accept terms" />);
    const mirror = container.querySelector('input[type="checkbox"]');
    expect(mirror).toHaveAttribute("aria-hidden", "true");
    expect(mirror).not.toHaveAttribute("aria-label");
  });

  it("validates required unnamed checkboxes without contributing FormData", async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Test form">
        <Checkbox required label="Accept terms" />
      </form>,
    );

    const form = getForm();
    const checkbox = screen.getByRole("checkbox", { name: /accept terms/i });

    expect(form.reportValidity()).toBe(false);
    expect(checkbox).toHaveFocus();
    await waitFor(() => expect(checkbox).toHaveAttribute("aria-invalid", "true"));
    expect(new FormData(form).entries().next().done).toBe(true);

    await user.click(checkbox);
    expect(form.checkValidity()).toBe(true);
    expect(checkbox).not.toHaveAttribute("aria-invalid");
    expect(new FormData(form).entries().next().done).toBe(true);
  });

  it("keeps data-value aligned with submitted value, including empty values", () => {
    const { rerender } = render(
      <form aria-label="Test form">
        <Checkbox name="choice" value="custom" defaultChecked label="Custom choice" />
      </form>,
    );
    const form = getForm();
    const checkbox = screen.getByRole("checkbox", { name: /custom choice/i });

    expect(checkbox).toHaveAttribute("data-value", "custom");
    expect(new FormData(form).get("choice")).toBe("custom");

    rerender(
      <form aria-label="Test form">
        <Checkbox name="choice" value="" defaultChecked label="Empty choice" />
      </form>,
    );

    expect(screen.getByRole("checkbox", { name: /empty choice/i })).toHaveAttribute(
      "data-value",
      "",
    );
    expect(new FormData(getForm()).get("choice")).toBe("");
  });

  it("passes native root props and composes root handlers", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const onFocus = vi.fn();
    const onKeyDown = vi.fn();
    render(
      <Checkbox
        label="Accept terms"
        data-source="external"
        style={{ maxWidth: "18px" }}
        onClick={onClick}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
      />,
    );

    const checkbox = screen.getByRole("checkbox", { name: /accept terms/i });
    await user.click(checkbox);
    checkbox.focus();
    await user.keyboard(" ");

    expect(onClick).toHaveBeenCalledOnce();
    expect(onFocus).toHaveBeenCalled();
    expect(onKeyDown).toHaveBeenCalled();
    expect(checkbox).toHaveAttribute("aria-checked", "false");
    expect(checkbox).toHaveAttribute("data-source", "external");
    expect(checkbox).toHaveStyle({ maxWidth: "18px" });
  });

  it("lets consumer click handlers prevent the built-in toggle", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Checkbox
        label="Accept terms"
        onChange={onChange}
        onClick={(event) => event.preventDefault()}
      />,
    );

    await user.click(screen.getByRole("checkbox", { name: /accept terms/i }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("checkbox", { name: /accept terms/i })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("lets consumer keyboard handlers prevent the built-in Space toggle", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Checkbox
        label="Accept terms"
        onChange={onChange}
        onKeyDown={(event) => event.preventDefault()}
      />,
    );

    screen.getByRole("checkbox", { name: /accept terms/i }).focus();
    await user.keyboard(" ");

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("checkbox", { name: /accept terms/i })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("has no a11y violations across states", async () => {
    const { container, rerender } = render(<Checkbox label="Accept terms" />);
    expect(await axe(container)).toHaveNoViolations();

    rerender(<Checkbox disabled label="Accept terms" />);
    expect(await axe(container)).toHaveNoViolations();

    rerender(<Checkbox checked="indeterminate" label="Select all" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
