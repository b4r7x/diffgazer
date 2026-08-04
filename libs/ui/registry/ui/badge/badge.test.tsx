import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "../../../testing/axe";
import { Badge, badgeVariants } from "./index";

describe("Badge", () => {
  it("has no accessibility violations", async () => {
    const { container } = render(<Badge dot>Ready</Badge>);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("renders no dot span when dot is unset", () => {
    const { container } = render(<Badge>Ready</Badge>);
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
  });

  it("keeps the xs size on the 10px tier of the bold uppercase tracked base", () => {
    // xs is the tier compact chips opt into (run scope, list tier badges), and the
    // recipe is where that chrome lives — consumers assert the primitive, not their
    // own copy of these classes.
    const xs = badgeVariants({ size: "xs" }).split(" ");

    expect(xs).toContain("text-2xs");
    expect(xs).toContain("uppercase");
    expect(xs).toContain("tracking-wider");
    expect(xs).toContain("font-bold");
  });

  it("renders the dot color through the --badge-dot theme var utility", () => {
    // The utility class is the mechanism under test: only the paren var() form is emitted by Tailwind v4.
    const { container } = render(<Badge dot>Ready</Badge>);
    const dot = container.querySelector('[aria-hidden="true"]');
    expect(dot).toHaveClass("bg-(--badge-dot)");
    // Prefix check, not a token check: it rejects every `bg-[--*]` spelling at once.
    expect(dot?.className ?? "").not.toContain("bg-[--");
  });
});
