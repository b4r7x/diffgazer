import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "../../../testing/axe";
import { Kbd } from "../kbd";
import { EmptyState } from "./index";

describe("EmptyState", () => {
  it("renders children without a live region by default", () => {
    render(<EmptyState>No results</EmptyState>);

    expect(screen.getByText("No results")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("renders live empty-state content immediately", () => {
    render(<EmptyState live>No results</EmptyState>);

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("No results");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveAttribute("aria-atomic", "true");
  });

  it("releases the live region when live toggles back off", () => {
    const { rerender } = render(<EmptyState live>No results</EmptyState>);
    expect(screen.getByRole("status")).toBeInTheDocument();

    rerender(<EmptyState>No results</EmptyState>);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByText("No results")).toBeInTheDocument();
  });

  it("has no a11y violations", async () => {
    const { container } = render(<EmptyState live>No results</EmptyState>);

    expect(await axe(container)).toHaveNoViolations();
  });

  describe("Hint", () => {
    it("renders as a quiet annotation row under the message", () => {
      const { container } = render(
        <EmptyState>
          <EmptyState.Message>No runs match this search</EmptyState.Message>
          <EmptyState.Hint>
            <kbd>Esc</kbd> clear search
          </EmptyState.Hint>
        </EmptyState>,
      );

      const hint = container.querySelector('[data-slot="empty-state-hint"]');
      expect(hint).not.toBeNull();
      expect(hint).toHaveTextContent("Esc clear search");
    });

    it.each([
      ["sm", "text-2xs"],
      ["md", "text-2xs"],
      ["lg", "text-xs"],
    ] as const)("takes its type scale from the root size context (%s)", (size, step) => {
      const { container } = render(
        <EmptyState size={size}>
          <EmptyState.Hint>press slash</EmptyState.Hint>
        </EmptyState>,
      );

      // Same mechanism the sibling parts use: the root publishes data-size and
      // each part carries a step per size that resolves against it.
      expect(container.firstElementChild).toHaveAttribute("data-size", size);
      expect(container.querySelector('[data-slot="empty-state-hint"]')).toHaveClass(
        `group-data-[size=${size}]/es:${step}`,
      );
    });

    it("is announced inside the live region after the message", () => {
      render(
        <EmptyState live>
          <EmptyState.Message>No runs match this search</EmptyState.Message>
          <EmptyState.Hint>
            <kbd>Esc</kbd> clear search
          </EmptyState.Hint>
        </EmptyState>,
      );

      expect(screen.getByRole("status")).toHaveTextContent(
        "No runs match this searchEsc clear search",
      );
    });

    it("has no a11y violations with a keyboard chip child", async () => {
      const { container } = render(
        <EmptyState live>
          <EmptyState.Message>No runs match this search</EmptyState.Message>
          <EmptyState.Hint>
            <Kbd size="sm">Esc</Kbd> clear search
          </EmptyState.Hint>
        </EmptyState>,
      );

      expect(await axe(container)).toHaveNoViolations();
    });
  });
});
