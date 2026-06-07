import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { axe } from "../../../testing/axe";
import { Input, InputGroup } from "./index";

describe("Input", () => {
  it("accepts typed text as a native textbox", async () => {
    const user = userEvent.setup();

    render(<Input aria-label="Email" />);

    await user.type(screen.getByRole("textbox", { name: "Email" }), "a@example.com");

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

    await user.type(screen.getByRole("textbox", { name: "Path" }), "config");

    expect(screen.getByText("~/")).toBeInTheDocument();
    expect(screen.getByText(".json")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Path" })).toHaveValue("config");
  });

  it("keeps interactive InputGroup suffix content accessible", () => {
    render(<InputGroup aria-label="Path" suffix={<button type="button">Browse</button>} />);

    expect(screen.getByRole("button", { name: "Browse" })).toBeInTheDocument();
  });

  it("lets consumers hide a decorative non-string affix from assistive tech", () => {
    render(
      <InputGroup
        aria-label="Amount"
        prefix={<span data-testid="currency">USD</span>}
        prefixAriaHidden
      />,
    );

    const prefix = screen.getByTestId("currency").parentElement;
    expect(prefix).toHaveAttribute("aria-hidden", "true");
  });

  it("forwards aria-invalid through InputGroup to the nested input", () => {
    render(<InputGroup aria-label="Path" aria-invalid />);

    expect(screen.getByRole("textbox", { name: "Path" })).toHaveAttribute("aria-invalid", "true");
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
