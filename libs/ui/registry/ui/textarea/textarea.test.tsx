import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { axe } from "../../../testing/axe";
import { Textarea } from "./index";

function handleMarkOf(resizer: HTMLElement) {
  const mark = resizer.querySelector('[data-slot="textarea-resize-handle"]');
  if (!(mark instanceof HTMLElement)) throw new Error("Textarea resize handle is missing");
  return mark;
}

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

  it("forwards its ref to the native textarea", () => {
    const ref = createRef<HTMLTextAreaElement>();

    render(<Textarea ref={ref} aria-label="Comment" resize="both" />);

    expect(ref.current).toBe(screen.getByRole("textbox", { name: "Comment" }));
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

  it("keeps a read-only textarea focusable, enabled and unedited", async () => {
    const user = userEvent.setup();
    render(<Textarea readOnly defaultValue="Generated output." aria-label="Comment" />);
    const textarea = screen.getByRole("textbox", { name: "Comment" });

    await user.tab();
    expect(textarea).toHaveFocus();
    expect(textarea).not.toBeDisabled();
    expect(textarea).not.toHaveAttribute("aria-disabled");

    await user.type(textarea, "abc");
    expect(textarea).toHaveValue("Generated output.");
  });

  it("resizes vertically from the default keyboard-accessible handle", async () => {
    const user = userEvent.setup();
    render(<Textarea aria-label="Comment" />);
    const textarea = screen.getByRole("textbox", { name: "Comment" });
    const handle = screen.getByRole("button", { name: "Resize textarea vertically" });
    Object.defineProperty(textarea, "getBoundingClientRect", { value: () => ({ height: 80 }) });

    await user.click(handle);
    await user.keyboard("{ArrowRight}");
    expect(textarea).not.toHaveAttribute("style");

    await user.keyboard("{ArrowDown}");

    expect(textarea).toHaveStyle({ height: "88px" });
  });

  it("respects the configured maximum size", async () => {
    const user = userEvent.setup();
    render(<Textarea aria-label="Comment" style={{ maxHeight: 84 }} />);
    const textarea = screen.getByRole("textbox", { name: "Comment" });
    const handle = screen.getByRole("button", { name: "Resize textarea vertically" });
    Object.defineProperty(textarea, "getBoundingClientRect", { value: () => ({ height: 80 }) });

    await user.click(handle);
    await user.keyboard("{ArrowDown}");

    expect(textarea).toHaveStyle({ height: "84px" });
  });

  it("resizes horizontally with ArrowLeft and ArrowRight", async () => {
    const user = userEvent.setup();
    render(<Textarea aria-label="Comment" resize="horizontal" />);
    const textarea = screen.getByRole("textbox", { name: "Comment" });
    const root = textarea.closest('[data-slot="textarea-root"]');
    const handle = screen.getByRole("button", { name: "Resize textarea horizontally" });
    if (!(root instanceof HTMLElement)) throw new Error("Textarea root is missing");
    Object.defineProperty(root, "getBoundingClientRect", {
      value: () => ({ width: Number.parseFloat(root.style.width) || 320 }),
    });

    await user.click(handle);
    await user.keyboard("{ArrowRight}");
    expect(root).toHaveStyle({ width: "328px" });

    await user.keyboard("{ArrowLeft}");
    expect(root).toHaveStyle({ width: "320px" });

    await user.keyboard("{Enter}");
    expect(root).toHaveStyle({ width: "328px" });
  });

  it("renders the handles selected by the resize prop", () => {
    const { rerender } = render(<Textarea aria-label="Comment" resize="none" />);
    expect(screen.getByRole("textbox", { name: "Comment" })).not.toHaveAttribute("resize");
    expect(screen.queryByRole("button", { name: /Resize textarea/ })).not.toBeInTheDocument();

    rerender(<Textarea aria-label="Comment" resize="horizontal" />);
    expect(
      screen.getByRole("button", { name: "Resize textarea horizontally" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Resize textarea vertically" }),
    ).not.toBeInTheDocument();

    rerender(<Textarea aria-label="Comment" resize="both" />);
    expect(screen.getByRole("button", { name: "Resize textarea vertically" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Resize textarea horizontally" }),
    ).toBeInTheDocument();
  });

  it("marks both edges with a wordless line handle by default", () => {
    render(<Textarea aria-label="Comment" resize="both" />);

    const verticalHandle = screen.getByRole("button", { name: "Resize textarea vertically" });
    const horizontalHandle = screen.getByRole("button", { name: "Resize textarea horizontally" });

    expect(handleMarkOf(verticalHandle)).toHaveAttribute("data-handle", "line");
    expect(handleMarkOf(horizontalHandle)).toHaveAttribute("data-handle", "line");
    expect(verticalHandle.textContent).toBe("");
    expect(horizontalHandle.textContent).toBe("");
  });

  it("labels the box handle with an arrow alone", () => {
    render(<Textarea aria-label="Comment" resizeHandle="box" />);

    const verticalHandle = screen.getByRole("button", { name: "Resize textarea vertically" });

    expect(handleMarkOf(verticalHandle)).toHaveAttribute("data-handle", "box");
    expect(verticalHandle).toHaveTextContent("↕");
    expect(verticalHandle).not.toHaveTextContent("resize");
  });

  it("labels the box-label handle with an arrow and the word resize", () => {
    render(<Textarea aria-label="Comment" resizeHandle="box-label" />);

    const verticalHandle = screen.getByRole("button", { name: "Resize textarea vertically" });

    expect(handleMarkOf(verticalHandle)).toHaveAttribute("data-handle", "box-label");
    expect(verticalHandle).toHaveTextContent("↕");
    expect(verticalHandle).toHaveTextContent("resize");
  });

  it("gives each edge its own handle from a per-axis resizeHandle", () => {
    const { rerender } = render(
      <Textarea
        aria-label="Comment"
        resize="both"
        resizeHandle={{ vertical: "box-label", horizontal: "line" }}
      />,
    );

    const verticalHandle = screen.getByRole("button", { name: "Resize textarea vertically" });
    const horizontalHandle = screen.getByRole("button", { name: "Resize textarea horizontally" });
    expect(handleMarkOf(verticalHandle)).toHaveAttribute("data-handle", "box-label");
    expect(verticalHandle).toHaveTextContent("resize");
    expect(handleMarkOf(horizontalHandle)).toHaveAttribute("data-handle", "line");
    expect(horizontalHandle.textContent).toBe("");

    rerender(<Textarea aria-label="Comment" resize="both" resizeHandle={{ horizontal: "box" }} />);

    expect(
      handleMarkOf(screen.getByRole("button", { name: "Resize textarea horizontally" })),
    ).toHaveAttribute("data-handle", "box");
    expect(
      handleMarkOf(screen.getByRole("button", { name: "Resize textarea vertically" })),
    ).toHaveAttribute("data-handle", "line");
  });

  it("points each arrow along the axis its handle resizes", () => {
    render(<Textarea aria-label="Comment" resize="both" resizeHandle="box-label" />);

    const verticalHandle = screen.getByRole("button", { name: "Resize textarea vertically" });
    const horizontalHandle = screen.getByRole("button", { name: "Resize textarea horizontally" });

    expect(verticalHandle).toHaveTextContent("↕");
    expect(verticalHandle).not.toHaveTextContent("↔");
    expect(horizontalHandle).toHaveTextContent("↔");
    expect(horizontalHandle).not.toHaveTextContent("↕");
  });

  it("does not render resize handles for fixed states", () => {
    const { rerender } = render(<Textarea aria-label="Comment" resize="both" readOnly />);
    expect(screen.queryByRole("button", { name: /Resize textarea/ })).not.toBeInTheDocument();

    rerender(<Textarea aria-label="Comment" resize="both" disabled />);
    expect(screen.queryByRole("button", { name: /Resize textarea/ })).not.toBeInTheDocument();
  });

  it("has no a11y violations across Textarea states", async () => {
    const { container, rerender } = render(<Textarea aria-label="Comment" />);
    expect(await axe(container)).toHaveNoViolations();

    rerender(<Textarea aria-label="Comment" aria-invalid />);
    expect(await axe(container)).toHaveNoViolations();

    rerender(<Textarea aria-label="Comment" resize="both" />);
    expect(await axe(container)).toHaveNoViolations();

    rerender(<Textarea aria-label="Comment" readOnly defaultValue="Generated output." />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
