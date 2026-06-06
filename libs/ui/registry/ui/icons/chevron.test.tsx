import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { Chevron } from "./index";

// axe skipped: decorative SVG icon with no semantic role under test.

describe("Chevron", () => {
  it("forwards svg props and refs", () => {
    const ref = createRef<SVGSVGElement>();

    render(
      <Chevron
        ref={ref}
        role="img"
        aria-hidden={false}
        aria-label="Expand"
        direction="down"
        open
        data-state="open"
        strokeWidth={1}
      />,
    );

    const icon = screen.getByRole("img", { name: "Expand" });
    expect(ref.current).toBe(icon);
    expect(icon).toHaveAttribute("data-state", "open");
    expect(icon).toHaveAttribute("stroke-width", "1");
    expect(icon).toHaveStyle({ transform: "rotate(180deg)" });
  });
});
