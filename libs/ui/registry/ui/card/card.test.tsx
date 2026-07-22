import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { axe } from "../../../testing/axe";
import { Card } from "./index";

describe("Card", () => {
  it("renders children as a div by default", () => {
    render(<Card>Content</Card>);

    expect(screen.getByText("Content").tagName).toBe("DIV");
  });

  it("renders as the specified element when as prop is provided", () => {
    render(
      <Card as="section" aria-label="Details">
        Section content
      </Card>,
    );

    expect(screen.getByRole("region", { name: "Details" })).toHaveTextContent("Section content");
  });

  it("forwards refs to the selected element", () => {
    const ref = createRef<HTMLElement>();

    render(
      <Card as="article" ref={ref} aria-label="Release">
        Notes
      </Card>,
    );

    expect(ref.current).toBe(screen.getByRole("article", { name: "Release" }));
  });

  it("sets data-interactive when interactive is true", () => {
    render(<Card interactive>Interactive content</Card>);

    const card = screen.getByText("Interactive content");
    expect(card).toHaveAttribute("data-interactive");
  });

  it("does not set data-interactive when interactive is false", () => {
    render(<Card>Non-interactive content</Card>);

    const card = screen.getByText("Non-interactive content");
    expect(card).not.toHaveAttribute("data-interactive");
  });

  it.each([
    "flat",
    "stacked",
    "inset",
    "dotted",
    "glow",
  ] as const)("renders data-surface='%s' with data-slot='card'", (surface) => {
    render(<Card surface={surface}>{surface} content</Card>);

    const card = screen.getByText(`${surface} content`);
    expect(card).toHaveAttribute("data-slot", "card");
    expect(card).toHaveAttribute("data-surface", surface);
  });

  it("defaults data-surface to 'flat' when no surface is provided", () => {
    render(<Card>Default surface</Card>);

    const card = screen.getByText("Default surface");
    expect(card).toHaveAttribute("data-surface", "flat");
  });

  it("renders as article with a surface variant", () => {
    render(
      <Card as="article" surface="stacked" aria-label="Release">
        Article stacked
      </Card>,
    );

    const card = screen.getByRole("article", { name: "Release" });
    expect(card).toHaveAttribute("data-surface", "stacked");
    expect(card).toHaveAttribute("data-slot", "card");
  });

  it.each([
    ["sm", "max-w-sm"],
    ["md", "max-w-md"],
    ["lg", "max-w-lg"],
  ] as const)("applies the documented cardVariants size mapping for size='%s'", (size, expectedClass) => {
    render(<Card size={size}>{size} card</Card>);

    const card = screen.getByText(`${size} card`);
    expect(card).toHaveClass(expectedClass);
  });

  it("renders an interactive card as a focusable button", async () => {
    const user = userEvent.setup();
    render(
      <Card as="button" type="button" interactive>
        Open
      </Card>,
    );

    document.body.focus();
    await user.tab();

    const card = screen.getByRole("button", { name: "Open" });
    expect(card).toHaveFocus();
    expect(card).toHaveAttribute("data-interactive");
  });

  it("renders an interactive card as a focusable link", async () => {
    const user = userEvent.setup();
    render(
      <Card as="a" href="#details" interactive>
        Details
      </Card>,
    );

    document.body.focus();
    await user.tab();

    const card = screen.getByRole("link", { name: "Details" });
    expect(card).toHaveFocus();
    expect(card).toHaveAttribute("href", "#details");
  });

  it("has no a11y violations", async () => {
    const { container } = render(
      <Card as="section" aria-label="Details">
        Section content
      </Card>,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
