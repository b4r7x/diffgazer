import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { axe } from "../../../testing/axe";
import { textareaDoc } from "../../component-docs/textarea";
import { Textarea } from "./index";

describe("Textarea", () => {
  it("accepts multiline text as a native textbox", async () => {
    const user = userEvent.setup();

    render(<Textarea aria-label="Comment" />);

    await user.type(screen.getByRole("textbox", { name: "Comment" }), "Line one{enter}Line two");

    expect(screen.getByRole("textbox", { name: "Comment" })).toHaveValue("Line one\nLine two");
  });

  it("passes the native change event to onChange", async () => {
    const user = userEvent.setup();
    let eventValue = "";
    let eventTarget: EventTarget | null = null;

    render(
      <Textarea
        aria-label="Comment"
        onChange={(event) => {
          eventValue = event.currentTarget.value;
          eventTarget = event.target;
        }}
      />,
    );

    const textarea = screen.getByRole("textbox", { name: "Comment" });
    await user.type(textarea, "a");

    expect(eventValue).toBe("a");
    expect(eventTarget).toBe(textarea);
  });

  it("forwards aria-invalid to the native textarea", () => {
    render(<Textarea aria-label="Comment" aria-invalid />);

    expect(screen.getByRole("textbox", { name: "Comment" })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("preserves aria-invalid false as a non-invalid value", () => {
    render(<Textarea aria-label="Comment" aria-invalid="false" />);

    const textarea = screen.getByRole("textbox", { name: "Comment" });
    expect(textarea).toHaveAttribute("aria-invalid", "false");
  });

  it("preserves grammar invalid state", () => {
    render(<Textarea aria-label="Comment" aria-invalid="grammar" />);

    const textarea = screen.getByRole("textbox", { name: "Comment" });
    expect(textarea).toHaveAttribute("aria-invalid", "grammar");
  });

  it.each([
    { size: "sm" as const, classes: ["px-2", "py-1", "text-xs"], inputHeight: "h-7" },
    { size: "md" as const, classes: ["px-3", "py-2", "text-sm"], inputHeight: "h-9" },
    { size: "lg" as const, classes: ["px-4", "py-2", "text-base"], inputHeight: "h-11" },
  ])("documents the shared resizable baseline for the $size size", ({
    size,
    classes,
    inputHeight,
  }) => {
    render(<Textarea aria-label="Comment" size={size} />);

    const textarea = screen.getByRole("textbox", { name: "Comment" });
    expect(textarea).toHaveClass("h-auto", "min-h-20", "resize-y", ...classes);
    expect(textarea).not.toHaveClass(inputHeight);
    expect(textareaDoc.props?.Textarea?.size).toEqual({
      type: '"sm" | "md" | "lg"',
      required: false,
      defaultValue: '"md"',
      description:
        "Padding and font-size token. Every size shares the same h-auto min-h-20 resize-y resizable baseline.",
    });
  });

  it("has no a11y violations across Textarea states", async () => {
    const { container, rerender } = render(<Textarea aria-label="Comment" />);
    expect(await axe(container)).toHaveNoViolations();

    rerender(<Textarea aria-label="Comment" aria-invalid />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
