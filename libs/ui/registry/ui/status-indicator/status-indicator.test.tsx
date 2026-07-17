import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "../../../testing/axe";
import StatusIndicatorDefault from "../../examples/status-indicator/status-indicator-default";
import { StatusIndicator } from "./status-indicator";

function getDot(container: HTMLElement) {
  return container.querySelector('[aria-hidden="true"]');
}

describe("StatusIndicator", () => {
  it("renders with role=status and label text", () => {
    render(<StatusIndicator>ONLINE</StatusIndicator>);
    expect(screen.getByRole("status")).toHaveTextContent("ONLINE");
  });

  it("pulses for online status by default", () => {
    const { container } = render(<StatusIndicator>ONLINE</StatusIndicator>);
    const dot = getDot(container);
    expect(dot).toHaveAttribute("data-status", "online");
    expect(dot).toHaveAttribute("data-pulse", "true");
  });

  it("disables pulse when pulse=false", () => {
    const { container } = render(<StatusIndicator pulse={false}>OFFLINE</StatusIndicator>);
    expect(getDot(container)).not.toHaveAttribute("data-pulse");
  });

  it("never pulses for busy status even with pulse enabled", () => {
    const { container } = render(
      <StatusIndicator status="busy" pulse>
        BUSY
      </StatusIndicator>,
    );
    const dot = getDot(container);
    expect(dot).toHaveAttribute("data-status", "busy");
    expect(dot).not.toHaveAttribute("data-pulse");
  });

  it("exposes the status word to assistive tech alongside the children", () => {
    render(<StatusIndicator status="busy">API</StatusIndicator>);
    const root = screen.getByRole("status");
    expect(root).toHaveTextContent("API");
    expect(root).toHaveTextContent("busy");
  });

  it("lets a consumer override the status word via label", () => {
    render(
      <StatusIndicator status="offline" label="unavailable">
        API
      </StatusIndicator>,
    );
    const root = screen.getByRole("status");
    expect(root).toHaveTextContent("unavailable");
    expect(root).not.toHaveTextContent("offline");
  });

  it("suppresses the status word when label is null", () => {
    render(
      <StatusIndicator status="online" label={null}>
        Live
      </StatusIndicator>,
    );
    const root = screen.getByRole("status");
    expect(root).toHaveTextContent("Live");
    expect(root).not.toHaveTextContent("online");
  });

  it("does not duplicate matching status text in the canonical example", () => {
    render(<StatusIndicatorDefault />);

    expect(
      screen
        .getAllByRole("status")
        .slice(0, 3)
        .map((status) => status.textContent),
    ).toEqual(["Online", "Busy", "Offline"]);
  });

  it("has no a11y violations", async () => {
    const { container } = render(<StatusIndicator>OPERATIONAL</StatusIndicator>);
    expect(await axe(container)).toHaveNoViolations();
  });
});
