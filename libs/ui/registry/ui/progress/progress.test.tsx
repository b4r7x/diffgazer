import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import { axe } from "../../../testing/axe";
import { atRuleBody, ruleBody } from "../../testing/css-contract";
import { Progress } from "./index";

describe("Progress", () => {
  it("defaults to the cell variant and surfaces the size on the track", () => {
    render(<Progress value={50} aria-label="Progress" />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("data-variant", "cells");
    expect(bar).toHaveAttribute("data-size", "md");
  });

  it('surfaces variant="bar" for the continuous track', () => {
    render(<Progress value={50} variant="bar" aria-label="Progress" />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("data-variant", "bar");
  });

  it("keeps the ARIA contract identical across variants", () => {
    const { rerender } = render(
      <Progress value={3} max={5} valueText="3 of 5" aria-label="Steps" />,
    );
    const read = () => {
      const bar = screen.getByRole("progressbar");
      return [
        bar.getAttribute("aria-valuenow"),
        bar.getAttribute("aria-valuemin"),
        bar.getAttribute("aria-valuemax"),
        bar.getAttribute("aria-valuetext"),
      ];
    };
    const cells = read();

    rerender(<Progress value={3} max={5} valueText="3 of 5" variant="bar" aria-label="Steps" />);
    expect(read()).toEqual(cells);
  });

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

  it("normalizes a NaN value to zero while remaining determinate", () => {
    render(<Progress value={Number.NaN} aria-label="Progress" />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "0");
    expect(bar).toHaveAttribute("data-state", "loaded");
    expect(bar.firstElementChild).toHaveStyle({ width: "0%" });
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

describe("Progress CSS contract", () => {
  // jsdom applies no stylesheet and drops @layer-nested rules from its CSSOM,
  // so the shipped source is the contract.
  const CSS_PATH = resolve(fileURLToPath(import.meta.url), "../progress.css");
  let css = "";

  beforeAll(() => {
    css = readFileSync(CSS_PATH, "utf8");
  });

  it("cuts the cell grid out of every size except the 4px track", () => {
    const masked = ruleBody(
      css,
      '[data-slot="progress"][data-variant="cells"]:not([data-size="sm"])',
    );
    expect(masked).not.toBeNull();
    expect(masked).toContain("mask-image: repeating-linear-gradient");
  });

  it("falls back to an outlined track with a Highlight fill in forced colors", () => {
    const forced = atRuleBody(css, "@media (forced-colors: active)");
    expect(ruleBody(forced, '[data-slot="progress"]')).toContain("mask-image: none");
    expect(ruleBody(forced, '[data-slot="progress-indicator"]')).toContain("background: Highlight");
  });
});
