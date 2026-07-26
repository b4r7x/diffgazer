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

  it("renders the dot color through the --badge-dot theme var utility", () => {
    // The utility class is the mechanism under test: only the paren var() form is emitted by Tailwind v4.
    const { container } = render(<Badge dot>Ready</Badge>);
    const dot = container.querySelector('[aria-hidden="true"]');
    expect(dot?.className).toContain("bg-(--badge-dot)");
    expect(dot?.className ?? "").not.toContain("bg-[--");
  });
});
