import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "../../../testing/axe";
import { inputDoc } from "../../component-docs/input";
import { fillField } from "../../testing/form-behavior";
import { Input, InputGroup } from "./index";

describe("Input", () => {
  it("accepts typed text as a native textbox", async () => {
    const user = userEvent.setup();

    render(<Input aria-label="Email" />);

    await fillField(user, "Email", "a@example.com");

    expect(screen.getByRole("textbox", { name: "Email" })).toHaveValue("a@example.com");
  });

  it("passes the native change event to onChange", async () => {
    const user = userEvent.setup();
    let eventValue = "";
    let eventTarget: EventTarget | null = null;

    render(
      <Input
        aria-label="Email"
        onChange={(event) => {
          eventValue = event.currentTarget.value;
          eventTarget = event.target;
        }}
      />,
    );

    const input = screen.getByRole("textbox", { name: "Email" });
    await user.type(input, "a");

    expect(eventValue).toBe("a");
    expect(eventTarget).toBe(input);
  });

  it("forwards aria-invalid to the native input", () => {
    render(<Input aria-label="Email" aria-invalid />);

    expect(screen.getByRole("textbox", { name: "Email" })).toHaveAttribute("aria-invalid", "true");
  });

  it("preserves aria-invalid false as a non-invalid value", () => {
    render(<Input aria-label="Email" aria-invalid="false" />);

    const input = screen.getByRole("textbox", { name: "Email" });
    expect(input).toHaveAttribute("aria-invalid", "false");
  });

  it("preserves grammar invalid state", () => {
    render(<Input aria-label="Email" aria-invalid="grammar" />);

    const input = screen.getByRole("textbox", { name: "Email" });
    expect(input).toHaveAttribute("aria-invalid", "grammar");
  });

  it("renders prefix and suffix affordances around the input", async () => {
    const user = userEvent.setup();

    render(<InputGroup aria-label="Path" prefix="~/" suffix=".json" />);

    await fillField(user, "Path", "config");

    expect(screen.getByText("~/")).toBeInTheDocument();
    expect(screen.getByText(".json")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Path" })).toHaveValue("config");
  });

  it("lets consumers hide a decorative non-string affix from assistive tech", () => {
    render(<InputGroup aria-label="Amount" prefix={<span>USD</span>} prefixAriaHidden />);

    const prefix = screen.getByText("USD").parentElement;
    expect(prefix).toHaveAttribute("aria-hidden", "true");
  });

  it("keeps the documented affix visibility defaults and overrides aligned with the DOM", () => {
    expect(inputDoc.props?.InputGroup?.prefixAriaHidden?.defaultValue).toBe(
      "true for string/number prefixes; false otherwise",
    );
    expect(inputDoc.props?.InputGroup?.suffixAriaHidden?.defaultValue).toBe(
      "true for string/number suffixes; false otherwise",
    );

    const { container, rerender } = render(
      <InputGroup aria-label="Amount" prefix="$" suffix={<span>USD</span>} />,
    );
    const prefix = container.querySelector('[data-slot="input-group-prefix"]');
    const suffix = container.querySelector('[data-slot="input-group-suffix"]');
    expect(prefix).toHaveAttribute("aria-hidden", "true");
    expect(suffix).not.toHaveAttribute("aria-hidden");

    rerender(
      <InputGroup
        aria-label="Amount"
        prefix="$"
        prefixAriaHidden={false}
        suffix={<span>USD</span>}
        suffixAriaHidden
      />,
    );
    expect(prefix).not.toHaveAttribute("aria-hidden");
    expect(suffix).toHaveAttribute("aria-hidden", "true");
  });

  it("forwards aria-invalid through InputGroup to the nested input", () => {
    render(<InputGroup aria-label="Path" aria-invalid />);

    expect(screen.getByRole("textbox", { name: "Path" })).toHaveAttribute("aria-invalid", "true");
  });

  it("focuses the input when a dead pointer zone (prefix) is clicked", async () => {
    const user = userEvent.setup();

    render(<InputGroup aria-label="Path" prefix="~/" suffix=".json" />);

    await user.click(screen.getByText("~/"));

    expect(screen.getByRole("textbox", { name: "Path" })).toHaveFocus();
  });

  it("does not steal focus from an interactive suffix button", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <InputGroup
        aria-label="Path"
        suffix={
          <button type="button" onClick={onClick}>
            Browse
          </button>
        }
      />,
    );

    await user.click(screen.getByRole("button", { name: "Browse" }));

    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.getByRole("textbox", { name: "Path" })).not.toHaveFocus();
  });

  it("has no a11y violations across Input and InputGroup states", async () => {
    const { container, rerender } = render(<Input aria-label="Email" />);
    expect(await axe(container)).toHaveNoViolations();

    rerender(<Input aria-label="Email" aria-invalid />);
    expect(await axe(container)).toHaveNoViolations();

    rerender(<InputGroup aria-label="Path" prefix="~/" suffix=".json" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
