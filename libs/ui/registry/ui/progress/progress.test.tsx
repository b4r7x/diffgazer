import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "../../../testing/axe";
import { Progress } from "./index";

describe("Progress", () => {
  it("renders with progressbar role and ARIA attributes", () => {
    render(<Progress value={50} aria-label="Upload progress" />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "50");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
    expect(bar).toHaveAttribute("aria-label", "Upload progress");
  });

  it("clamps value between 0 and max", () => {
    const { rerender } = render(<Progress value={150} aria-label="Progress" />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");

    rerender(<Progress value={-10} aria-label="Progress" />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  });

  it("renders indeterminate mode when value is undefined", () => {
    render(<Progress aria-label="Loading" />);
    const bar = screen.getByRole("progressbar");
    expect(bar).not.toHaveAttribute("aria-valuenow");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
  });

  it("supports custom max", () => {
    render(<Progress value={3} max={10} aria-label="Steps" />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "3");
    expect(bar).toHaveAttribute("aria-valuemax", "10");
  });

  it.each([
    0,
    -1,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ])("normalizes invalid max %s to the default maximum", (max) => {
    render(<Progress value={25} max={max} aria-label="Progress" />);

    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
    expect(bar).toHaveAttribute("aria-valuenow", "25");
    expect(bar.firstElementChild).toHaveStyle({ width: "25%" });
  });

  it("supports aria-labelledby", () => {
    render(
      <>
        <span id="lbl">File upload</span>
        <Progress value={75} aria-labelledby="lbl" />
      </>,
    );
    expect(screen.getByRole("progressbar", { name: "File upload" })).toBeInTheDocument();
  });

  it("reflects a determinate value as the fill width", () => {
    render(<Progress value={25} max={50} aria-label="Progress" />);
    const fill = screen.getByRole("progressbar").firstElementChild;
    expect(fill).toHaveStyle({ width: "50%" });
  });

  it("does not constrain the fill width when indeterminate", () => {
    render(<Progress aria-label="Loading" />);
    const fill = screen.getByRole("progressbar").firstElementChild;
    expect((fill as HTMLElement).style.width).toBe("");
  });

  it("exposes a consumer valueText as aria-valuetext", () => {
    render(<Progress value={3} max={5} valueText="3 of 5 steps" aria-label="Steps" />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuetext", "3 of 5 steps");
  });

  it("merges consumer rest props onto the progressbar", () => {
    render(
      <>
        <span id="hint">Uploading</span>
        <Progress
          value={50}
          aria-label="Upload"
          id="upload"
          aria-describedby="hint"
          title="Upload progress"
        />
      </>,
    );
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("id", "upload");
    expect(bar).toHaveAttribute("aria-describedby", "hint");
    expect(bar).toHaveAttribute("title", "Upload progress");
  });

  it("has no a11y violations", async () => {
    const { container, rerender } = render(<Progress value={50} aria-label="Progress" />);
    expect(await axe(container)).toHaveNoViolations();

    rerender(<Progress aria-label="Loading" />);
    expect(await axe(container)).toHaveNoViolations();

    rerender(<Progress value={3} max={5} valueText="3 of 5 steps" aria-label="Steps" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
