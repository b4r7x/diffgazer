import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "../../../testing/axe";
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

  it("toggles on click in controlled mode", async () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange} aria-label="Toggle" />);
    await userEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  });

  it("toggles on click in uncontrolled mode", async () => {
    const onChange = vi.fn();
    render(<Switch onChange={onChange} aria-label="Toggle" />);
    const sw = screen.getByRole("switch");
    expect(sw).toHaveAttribute("aria-checked", "false");

    await userEvent.click(sw);
    expect(onChange).toHaveBeenCalledWith(true);
    expect(sw).toHaveAttribute("aria-checked", "true");

    await userEvent.click(sw);
    expect(onChange).toHaveBeenCalledWith(false);
    expect(sw).toHaveAttribute("aria-checked", "false");
  });

  it("toggles on Space key", async () => {
    const onChange = vi.fn();
    render(<Switch onChange={onChange} aria-label="Toggle" />);
    screen.getByRole("switch").focus();
    await userEvent.keyboard(" ");
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("toggles on Enter key", async () => {
    const onChange = vi.fn();
    render(<Switch onChange={onChange} aria-label="Toggle" />);
    screen.getByRole("switch").focus();
    await userEvent.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("does not toggle when disabled", async () => {
    const onChange = vi.fn();
    render(<Switch disabled onChange={onChange} aria-label="Toggle" />);
    const sw = screen.getByRole("switch");

    await userEvent.click(sw);
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
    render(
      <form aria-label="Test form">
        <Switch name="toggle" defaultChecked aria-label="Toggle" />
      </form>,
    );

    await userEvent.click(screen.getByRole("switch"));
    const form = getForm();
    expect(new FormData(form).has("toggle")).toBe(false);

    form.reset();
    await waitFor(() => expect(new FormData(form).get("toggle")).toBe("on"));
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
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

  it("clears the invalid state once the required switch is turned on", async () => {
    render(
      <form aria-label="Test form">
        <Switch name="accept" required aria-label="Accept" />
      </form>,
    );

    const form = getForm();
    const sw = screen.getByRole("switch", { name: /accept/i });

    expect(form.reportValidity()).toBe(false);
    await waitFor(() => expect(sw).toHaveAttribute("aria-invalid", "true"));

    await userEvent.click(sw);
    expect(form.checkValidity()).toBe(true);
    expect(sw).not.toHaveAttribute("aria-invalid");
  });

  it("lets consumer click handlers prevent the built-in toggle", async () => {
    const onChange = vi.fn();
    render(
      <Switch
        aria-label="Toggle"
        onChange={onChange}
        onClick={(event) => event.preventDefault()}
      />,
    );

    await userEvent.click(screen.getByRole("switch"));

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
