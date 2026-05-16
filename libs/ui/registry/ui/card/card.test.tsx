import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "../../../testing/utils.js";
import { Card } from "./index.js";

describe("Card", () => {
  it("renders children as a div by default", () => {
    render(<Card>Content</Card>);

    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("renders as the specified element when as prop is provided", () => {
    render(
      <Card as="section" aria-label="Details">
        Section content
      </Card>,
    );

    expect(screen.getByRole("region", { name: "Details" })).toHaveTextContent("Section content");
  });

  it("forwards refs to the selected element", () => {
    const ref = createRef<HTMLElement>();

    render(
      <Card as="article" ref={ref} aria-label="Release">
        Notes
      </Card>,
    );

    expect(ref.current).toBe(screen.getByRole("article", { name: "Release" }));
  });

  it("has no a11y violations", async () => {
    const { container } = render(
      <Card as="section" aria-label="Details">
        Section content
      </Card>,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
