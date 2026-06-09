import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "../../../testing/axe";
import { StatusIndicator } from "./status-indicator";

describe("StatusIndicator", () => {
  it("renders with role=status and label text", () => {
    render(<StatusIndicator>ONLINE</StatusIndicator>);
    expect(screen.getByRole("status")).toHaveTextContent("ONLINE");
  });

  it("applies pulse animation for online status by default", () => {
    const { container } = render(<StatusIndicator>ONLINE</StatusIndicator>);
    const dot = container.querySelector('[aria-hidden="true"]');
    expect(dot).toHaveClass("animate-pulse");
  });

  it("disables pulse when pulse=false", () => {
    const { container } = render(
      <StatusIndicator pulse={false}>
        OFFLINE
      </StatusIndicator>,
    );
    const dot = container.querySelector('[aria-hidden="true"]');
    expect(dot).not.toHaveClass("animate-pulse");
  });

  it("has no a11y violations", async () => {
    const { container } = render(<StatusIndicator>OPERATIONAL</StatusIndicator>);
    expect(await axe(container)).toHaveNoViolations();
  });
});
