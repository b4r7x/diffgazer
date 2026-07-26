import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Logo } from "./index";

describe("Logo", () => {
  it("renders plain static text without requiring figlet output", () => {
    render(<Logo text="DIFFGAZER" />);

    expect(screen.getByText("DIFFGAZER")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("uses precomputed ascii text when provided", () => {
    render(<Logo text="OK" asciiText={" O \n K "} />);

    expect(screen.getByRole("img", { name: "OK" })).toHaveTextContent(" O \n K ", {
      normalizeWhitespace: false,
    });
  });

  // Overflow contract: <pre> never wraps, so content wider than the container must clip inside the
  // component rather than widen it. jsdom computes no layout, so the guard is asserted through its
  // class tokens on both branches.
  it("clips overflow on the ascii and the plain-text branch alike", () => {
    const wide = `${"#".repeat(200)}\n${"#".repeat(200)}`;
    const { rerender } = render(<Logo text="DG" asciiText={wide} />);

    expect(screen.getByRole("img", { name: "DG" })).toHaveClass("max-w-full", "overflow-hidden");

    rerender(<Logo text={"DIFFGAZER".repeat(20)} />);
    expect(screen.getByText(/^DIFFGAZER/)).toHaveClass("max-w-full", "overflow-hidden");
  });
});
