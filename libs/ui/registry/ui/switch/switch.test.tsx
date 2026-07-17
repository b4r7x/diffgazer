import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "../../../testing/axe";
import { expectResetClearsInvalid } from "../../testing/form-behavior";
import { Switch } from "./index";

function getForm(name = "Test form"): HTMLFormElement {
  const form = screen.getByRole("form", { name });
  if (!(form instanceof HTMLFormElement)) throw new Error("Expected form test element");
  return form;
}

describe("Switch", () => {
  it("renders with role switch and default unchecked state", () => {
    render(<Switch aria-label="Toggle" />);
    const sw = screen.getByRole("switch");
    expect(sw).toHaveAttribute("aria-checked", "false");
  });

  it("renders checked state when controlled", () => {
    render(<Switch checked aria-label="Toggle" />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });

  it("emits data-slot and data-state styling hooks", () => {
    const { rerender } = render(<Switch checked={false} aria-label="Toggle" />);
    const sw = screen.getByRole("switch");
    expect(sw).toHaveAttribute("data-slot", "switch");
    expect(sw).toHaveAttribute("data-state", "unchecked");
    rerender(<Switch checked aria-label="Toggle" />);
    expect(sw).toHaveAttribute("data-state", "checked");
    rerender(<Switch checked disabled aria-label="Toggle" />);
    expect(sw).toHaveAttribute("data-disabled", "");
  });

  it("toggles on click in controlled mode", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange} aria-label="Toggle" />);
    await user.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  });

  it("toggles on click in uncontrolled mode", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Switch onChange={onChange} aria-label="Toggle" />);
    const sw = screen.getByRole("switch");
    expect(sw).toHaveAttribute("aria-checked", "false");

    await user.click(sw);
    expect(onChange).toHaveBeenCalledWith(true);
    expect(sw).toHaveAttribute("aria-checked", "true");

    await user.click(sw);
    expect(onChange).toHaveBeenCalledWith(false);
    expect(sw).toHaveAttribute("aria-checked", "false");
  });

  it("toggles on Space key", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Switch onChange={onChange} aria-label="Toggle" />);
    screen.getByRole("switch").focus();
    await user.keyboard(" ");
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("toggles on Enter key", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Switch onChange={onChange} aria-label="Toggle" />);
    screen.getByRole("switch").focus();
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("does not toggle when disabled", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Switch disabled onChange={onChange} aria-label="Toggle" />);
    const sw = screen.getByRole("switch");

    await user.click(sw);
    expect(onChange).not.toHaveBeenCalled();
    expect(sw).toHaveAttribute("aria-checked", "false");
  });

  it("renders aria-invalid and aria-required when set", () => {
    render(<Switch aria-invalid required aria-label="Toggle" />);
    const sw = screen.getByRole("switch");
    expect(sw).toHaveAttribute("aria-invalid", "true");
    expect(sw).toHaveAttribute("aria-required", "true");
  });

  it("provides accessible name from aria-label", () => {
    render(<Switch aria-label="Dark mode" />);
    expect(screen.getByRole("switch", { name: "Dark mode" })).toBeInTheDocument();
  });

  it("provides accessible name from aria-labelledby", () => {
    render(
      <>
        <span id="lbl">Notifications</span>
        <Switch aria-labelledby="lbl" />
      </>,
    );
    expect(screen.getByRole("switch", { name: "Notifications" })).toBeInTheDocument();
  });

  it("renders hidden input for form submission", () => {
    render(
      <form aria-label="Test form">
        <Switch name="darkMode" defaultChecked aria-label="Dark mode" />
      </form>,
    );
    const form = getForm();
    expect(new FormData(form).get("darkMode")).toBe("on");
  });

  it("uses custom value for form submission", () => {
    render(
      <form aria-label="Test form">
        <Switch name="theme" value="dark" defaultChecked aria-label="Theme" />
      </form>,
    );
    const form = getForm();
    expect(new FormData(form).get("theme")).toBe("dark");
  });

  it("does not include hidden input when neither name nor required", () => {
    const { container } = render(<Switch aria-label="Toggle" />);
    expect(container.querySelector("input[type=checkbox]")).toBeNull();
  });

  it("resets uncontrolled state with native form reset", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <form aria-label="Test form">
        <Switch name="toggle" defaultChecked onChange={onChange} aria-label="Toggle" />
      </form>,
    );

    await user.click(screen.getByRole("switch"));
    const form = getForm();
    expect(document.querySelector<HTMLInputElement>('[data-slot="switch-form-mirror"]')?.form).toBe(
      form,
    );
    expect(new FormData(form).has("toggle")).toBe(false);
    expect(onChange).toHaveBeenCalledOnce();

    form.reset();
    await waitFor(() => expect(new FormData(form).get("toggle")).toBe("on"));
    await waitFor(() => expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true"));
    expect(onChange).toHaveBeenCalledOnce();
  });

  it("keeps a Switch activation newer than a same-task form reset", async () => {
    render(
      <form aria-label="Test form">
        <Switch name="toggle" aria-label="Toggle" />
      </form>,
    );
    const control = screen.getByRole("switch");
    const form = getForm();

    form.reset();
    // fireEvent retained: activation must remain in the reset task before its microtask can flush.
    fireEvent.click(control);
    await Promise.resolve();

    expect(control).toHaveAttribute("aria-checked", "true");
    expect(new FormData(form).get("toggle")).toBe("on");
  });

  it("applies a Switch reset before a later activation", async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Test form">
        <Switch name="toggle" defaultChecked aria-label="Toggle" />
      </form>,
    );
    const control = screen.getByRole("switch");
    const form = getForm();

    await user.click(control);
    expect(new FormData(form).has("toggle")).toBe(false);

    form.reset();
    await waitFor(() => expect(new FormData(form).get("toggle")).toBe("on"));
    expect(control).toHaveAttribute("aria-checked", "true");

    await user.click(control);
    expect(control).toHaveAttribute("aria-checked", "false");
    expect(new FormData(form).has("toggle")).toBe(false);
  });

  it("submits to and resets with an explicit remote form instead of its physical ancestor", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <>
        <form aria-label="Physical form">
          <Switch
            form="remote-form"
            name="notifications"
            value="enabled"
            defaultChecked
            onChange={onChange}
            aria-label="Notifications"
          />
        </form>
        <form id="remote-form" aria-label="Remote form" />
      </>,
    );

    const physical = getForm("Physical form");
    const remote = getForm("Remote form");
    const mirror = document.querySelector<HTMLInputElement>('[data-slot="switch-form-mirror"]');
    expect(mirror?.form).toBe(remote);
    expect(new FormData(physical).has("notifications")).toBe(false);
    expect(new FormData(remote).get("notifications")).toBe("enabled");

    await user.click(screen.getByRole("switch", { name: "Notifications" }));
    expect(new FormData(remote).has("notifications")).toBe(false);
    expect(onChange).toHaveBeenCalledOnce();

    remote.reset();
    await waitFor(() => expect(new FormData(remote).get("notifications")).toBe("enabled"));
    await waitFor(() =>
      expect(screen.getByRole("switch", { name: "Notifications" })).toHaveAttribute(
        "aria-checked",
        "true",
      ),
    );
    expect(onChange).toHaveBeenCalledOnce();
  });

  it("focuses the switch when native required validation fails", async () => {
    render(
      <form aria-label="Test form">
        <Switch name="accept" required aria-label="Accept" />
      </form>,
    );

    const form = getForm();
    const sw = screen.getByRole("switch", { name: /accept/i });

    expect(form.reportValidity()).toBe(false);
    expect(sw).toHaveFocus();
    await waitFor(() => expect(sw).toHaveAttribute("aria-invalid", "true"));
  });

  it("clears aria-invalid on native form reset after a failed submit", async () => {
    render(
      <form aria-label="Test form">
        <Switch name="accept" required aria-label="Accept" />
      </form>,
    );

    await expectResetClearsInvalid(getForm(), screen.getByRole("switch", { name: /accept/i }));
  });

  it("keeps the hidden form-mirror input out of the a11y tree with no aria-label", () => {
    const { container } = render(<Switch name="accept" required aria-label="Accept" />);
    const mirror = container.querySelector('input[type="checkbox"]');
    expect(mirror).toHaveAttribute("aria-hidden", "true");
    expect(mirror).not.toHaveAttribute("aria-label");
  });

  it("clears the invalid state once the required switch is turned on", async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Test form">
        <Switch name="accept" required aria-label="Accept" />
      </form>,
    );

    const form = getForm();
    const sw = screen.getByRole("switch", { name: /accept/i });

    expect(form.reportValidity()).toBe(false);
    await waitFor(() => expect(sw).toHaveAttribute("aria-invalid", "true"));

    await user.click(sw);
    expect(form.checkValidity()).toBe(true);
    expect(sw).not.toHaveAttribute("aria-invalid");
  });

  it("lets consumer click handlers prevent the built-in toggle", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Switch
        aria-label="Toggle"
        onChange={onChange}
        onClick={(event) => event.preventDefault()}
      />,
    );

    await user.click(screen.getByRole("switch"));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  });

  it("has no a11y violations across states", async () => {
    const { container, rerender } = render(<Switch aria-label="Toggle" />);
    expect(await axe(container)).toHaveNoViolations();

    rerender(<Switch disabled aria-label="Toggle" />);
    expect(await axe(container)).toHaveNoViolations();

    rerender(<Switch checked aria-label="Toggle" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
