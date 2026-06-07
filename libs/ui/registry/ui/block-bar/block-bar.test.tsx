import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BlockBar } from "./index";

// axe skipped: meter role semantics (label/value/min/max) are asserted directly via aria-* attribute checks.

describe("BlockBar", () => {
  it("clamps invalid root values before rendering meter state", () => {
    expect(() =>
      render(
        <BlockBar
          label="Progress"
          max={Number.NaN}
          value={Number.POSITIVE_INFINITY}
          barWidth={Number.NaN}
        />,
      ),
    ).not.toThrow();

    const meter = screen.getByRole("meter", { name: "Progress" });
    expect(meter).toHaveAttribute("aria-valuemin", "0");
    expect(meter).toHaveAttribute("aria-valuemax", "0");
    expect(meter).toHaveAttribute("aria-valuenow", "0");
    expect(meter).toHaveAttribute("aria-valuetext", "0 of 0");
  });

  it("clamps display values to the meter range", () => {
    render(<BlockBar label="Capacity" max={10} value={25} barWidth={5} />);

    const meter = screen.getByRole("meter", { name: "Capacity" });
    expect(meter).toHaveAttribute("aria-valuenow", "10");
    expect(meter).toHaveTextContent("10");
  });

  it("uses app-owned value text for meter announcements", () => {
    render(<BlockBar label="Critical issues" max={10} value={3} valueText="3 critical issues" />);

    expect(screen.getByRole("meter", { name: "Critical issues" })).toHaveAttribute(
      "aria-valuetext",
      "3 critical issues",
    );
  });

  it("sanitizes segment values before drawing characters", () => {
    render(
      <BlockBar
        label="Segments"
        max={10}
        barWidth={5}
        segments={[{ value: Number.NaN }, { value: -5 }, { value: 4 }]}
      />,
    );

    const meter = screen.getByRole("meter", { name: "Segments" });
    expect(meter).toHaveAttribute("aria-valuenow", "4");
  });

  it("keeps the accessible label when custom segment children are provided", () => {
    render(
      <BlockBar label="Custom usage" max={10} barWidth={5}>
        <BlockBar.Segment value={20} char="x" />
      </BlockBar>,
    );

    const meter = screen.getByRole("meter", { name: "Custom usage" });
    expect(meter).toHaveAttribute("aria-valuenow", "10");
    expect(meter).toHaveAttribute("aria-valuetext", "10 of 10");
  });

  it("requires an explicit value when custom children are not segments", () => {
    expect(() =>
      render(
        <BlockBar label="Custom usage" max={10} barWidth={5}>
          <span>custom</span>
        </BlockBar>,
      ),
    ).toThrow("BlockBar requires `value`");
  });

  it("clips drawn segments to the configured character width", () => {
    render(
      <BlockBar label="Clipped" max={10} value={25} barWidth={5} filledChar="x" emptyChar="_" />,
    );

    const meter = screen.getByRole("meter", { name: "Clipped" });
    expect(meter).toHaveAttribute("aria-valuenow", "10");
    expect(screen.getByText("xxxxx")).toBeInTheDocument();
    expect(screen.queryByText("xxxxxx")).not.toBeInTheDocument();
  });

  it("lets segments define rendering and value when segments and children are mixed", () => {
    render(
      <BlockBar
        label="Mixed"
        max={10}
        barWidth={5}
        filledChar="x"
        emptyChar="_"
        segments={[{ value: 6 }]}
      >
        <BlockBar.Segment value={2} char="z" />
      </BlockBar>,
    );

    const meter = screen.getByRole("meter", { name: "Mixed" });

    expect(meter).toHaveAttribute("aria-valuenow", "6");
    expect(screen.getByText("xxx")).toBeInTheDocument();
    expect(screen.queryByText("z")).not.toBeInTheDocument();
  });

  it("accepts aria-label for the meter accessible name", () => {
    render(<BlockBar aria-label="Upload progress" max={10} value={5} />);
    expect(screen.getByRole("meter", { name: "Upload progress" })).toBeInTheDocument();
  });

  it("accepts aria-labelledby for the meter accessible name", () => {
    render(
      <>
        <span id="bar-label">Download speed</span>
        <BlockBar aria-labelledby="bar-label" max={100} value={42} />
      </>,
    );
    expect(screen.getByRole("meter", { name: "Download speed" })).toBeInTheDocument();
  });

  it("does not render an unnamed meter", () => {
    render(<BlockBar max={10} value={5} />);
    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("clamps excessive bar widths before drawing", () => {
    render(
      <BlockBar
        label="Wide"
        max={1000}
        value={1000}
        barWidth={10000}
        filledChar="x"
        emptyChar="_"
      />,
    );

    const meter = screen.getByRole("meter", { name: "Wide" });

    expect(meter).toHaveAttribute("aria-valuenow", "1000");
    expect(screen.getByText("x".repeat(200))).toBeInTheDocument();
    expect(screen.queryByText("x".repeat(201))).not.toBeInTheDocument();
  });
});
