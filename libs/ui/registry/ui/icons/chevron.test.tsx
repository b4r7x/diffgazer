import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { axe } from "../../../testing/axe";
import { iconsDoc } from "../../component-docs/icons";
import { Chevron } from "./index";

describe("Chevron", () => {
  it("defaults to decorative while documenting the labelled semantic-icon path", () => {
    const { container } = render(<Chevron />);
    const icon = container.querySelector("svg");
    const accessibilityNote = iconsDoc.notes?.find((note) => note.title === "Accessibility");

    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(accessibilityNote?.content).toContain('`aria-hidden="true"`');
    expect(accessibilityNote?.content).toContain('role="img"');
    expect(accessibilityNote?.content).toContain("accessible name");
  });

  it("forwards svg props and refs for a labelled semantic icon", async () => {
    const ref = createRef<SVGSVGElement>();

    const { container } = render(
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
    expect(await axe(container)).toHaveNoViolations();
  });
});
