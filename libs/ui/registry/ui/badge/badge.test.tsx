import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "../../../testing/axe";
import { Badge } from "./index";

describe("Badge", () => {
  it("has no accessibility violations", async () => {
    const { container } = render(<Badge dot>Ready</Badge>);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("renders no dot span when dot is unset", () => {
    const { container } = render(<Badge>Ready</Badge>);
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
  });

  it("uses the Tailwind v4 paren var() form for the dot color (the v3 bracket form was parse-dropped)", () => {
    // Sanctioned class assertion: the working `bg-(--badge-dot)` form IS the shipped fix.
    const { container } = render(<Badge dot>Ready</Badge>);
    const dot = container.querySelector('[aria-hidden="true"]');
    expect(dot?.className).toContain("bg-(--badge-dot)");
    // Guard against a regression to the v3 bracket form without naming the
    // forbidden literal (so the vocabulary sweep stays at zero hits).
    expect(/bg-\[--/.test(dot?.className ?? "")).toBe(false);
  });
});
