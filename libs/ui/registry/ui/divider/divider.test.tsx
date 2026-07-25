import { render, screen } from "@testing-library/react";
import { describe, expect, expectTypeOf, it } from "vitest";
import { Divider, type DividerProps } from "./index";

describe("Divider", () => {
  it("hides decorative spaced text from the accessibility tree", () => {
    const { container } = render(<Divider variant="spaced">Section</Divider>);

    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it("exposes meaningful separators when decorative is false", () => {
    render(
      <Divider
        decorative={false}
        aria-label="Section boundary"
        orientation="vertical"
        variant="spaced"
      >
        Section
      </Divider>,
    );

    const separator = screen.getByRole("separator", { name: "Section boundary" });
    expect(separator).toHaveAttribute("aria-orientation", "vertical");
    expect(screen.getByText("Section")).toBeInTheDocument();
  });

  // Contrast is a computed-color contract jsdom cannot measure, so this asserts the class that
  // carries it: the dimming lives on the rules only. Back on the root it dragged the visible label
  // to roughly 2:1, well under the 4.5:1 the label owes as real text.
  it("dims the rules but not the spaced label", () => {
    const { container } = render(<Divider variant="spaced">or</Divider>);

    expect(container.firstElementChild).not.toHaveClass("opacity-40");
    expect(screen.getByText("or")).not.toHaveClass("opacity-40");
    for (const rule of container.querySelectorAll("span.flex-1")) {
      expect(rule).toHaveClass("opacity-40");
    }
  });

  it("requires an explicit aria-label for semantic separators", () => {
    expectTypeOf<{ decorative: false; "aria-label": string }>().toMatchTypeOf<DividerProps>();
    expectTypeOf<{ decorative: false }>().not.toMatchTypeOf<DividerProps>();
    expectTypeOf<{ decorative: true }>().toMatchTypeOf<DividerProps>();
  });
});
