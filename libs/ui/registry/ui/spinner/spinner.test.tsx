import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "../../../testing/axe";
import { Spinner } from "./index";

const originalMatchMedia = window.matchMedia;

function mockMatchMedia(matches: boolean) {
  const mql = {
    matches,
    media: "(prefers-reduced-motion: reduce)",
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockReturnValue(mql),
  });

  return mql;
}

afterEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: originalMatchMedia,
  });
});

describe("Spinner", () => {
  it("renders with role=status and default label when no children", () => {
    render(<Spinner />);
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });

  it("renders with role=status and no aria-label when children are provided", () => {
    render(<Spinner>Processing...</Spinner>);
    const status = screen.getByRole("status");
    expect(status).not.toHaveAttribute("aria-label");
    expect(status).toHaveTextContent("Processing...");
  });

  it("has no a11y violations", async () => {
    const { container } = render(<Spinner />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no a11y violations with children", async () => {
    const { container } = render(<Spinner>Loading data...</Spinner>);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("forwards refs to the status element", () => {
    const ref = createRef<HTMLSpanElement>();
    render(<Spinner ref={ref} />);

    expect(ref.current).toBe(screen.getByRole("status", { name: "Loading" }));
  });

  it("renders accessible status when reduced motion is requested", () => {
    mockMatchMedia(true);

    render(<Spinner variant="braille" />);

    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });

  it("does not crash when matchMedia is unavailable", () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: undefined,
    });

    expect(() => render(<Spinner variant="braille" />)).not.toThrow();
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });
});
