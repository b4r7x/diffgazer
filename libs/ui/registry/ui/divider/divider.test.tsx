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

  it("requires an explicit aria-label for semantic separators", () => {
    expectTypeOf<{ decorative: false; "aria-label": string }>().toMatchTypeOf<DividerProps>();
    expectTypeOf<{ decorative: false }>().not.toMatchTypeOf<DividerProps>();
    expectTypeOf<{ decorative: true }>().toMatchTypeOf<DividerProps>();
  });
});
