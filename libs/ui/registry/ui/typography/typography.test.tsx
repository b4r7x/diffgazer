import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Typography } from "./index.js";

// axe skipped: presentational text wrapper; semantics depend on the `as` element chosen by the consumer.

describe("Typography", () => {
  it("renders children with the specified element", () => {
    render(<Typography as="p">Body copy</Typography>);

    expect(screen.getByText("Body copy")).toBeInTheDocument();
    expect(screen.getByText("Body copy").tagName).toBe("P");
  });

  it("forwards refs to the selected element", () => {
    const ref = createRef<HTMLParagraphElement>();

    render(
      <Typography as="p" ref={ref}>
        Body copy
      </Typography>,
    );

    expect(ref.current).toBe(screen.getByText("Body copy"));
  });

  it.each([
    { as: "h1" as const, level: 1, defaultSizeClass: "text-3xl" },
    { as: "h2" as const, level: 2, defaultSizeClass: "text-2xl" },
    { as: "h3" as const, level: 3, defaultSizeClass: "text-xl" },
    { as: "h4" as const, level: 4, defaultSizeClass: "text-lg" },
    { as: "h5" as const, level: 5, defaultSizeClass: "text-base" },
    { as: "h6" as const, level: 6, defaultSizeClass: "text-sm" },
  ])(
    "renders $as as a semantic heading with default size $defaultSizeClass",
    ({ as, level, defaultSizeClass }) => {
      render(<Typography as={as}>Heading {level}</Typography>);

      const heading = screen.getByRole("heading", { level });
      expect(heading).toBeInTheDocument();
      expect(heading.tagName).toBe(as.toUpperCase());
      // size variant IS the public contract — class assertion is the documented signal
      expect(heading).toHaveClass(defaultSizeClass);
    },
  );

  it("lets explicit size prop override the heading default", () => {
    render(
      <Typography as="h1" size="sm">
        Override
      </Typography>,
    );

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveClass("text-sm");
    expect(heading).not.toHaveClass("text-3xl");
  });

  it("forwards refs for heading elements", () => {
    const ref = createRef<HTMLHeadingElement>();

    render(
      <Typography as="h2" ref={ref}>
        Section title
      </Typography>,
    );

    expect(ref.current).toBe(screen.getByRole("heading", { level: 2 }));
  });

  it.each([
    { weight: "normal" as const, expected: "font-normal" },
    { weight: "medium" as const, expected: "font-medium" },
    { weight: "semibold" as const, expected: "font-semibold" },
    { weight: "bold" as const, expected: "font-bold" },
  ])(
    "renders $weight weight with class $expected",
    ({ weight, expected }) => {
      render(<Typography weight={weight}>Text</Typography>);
      expect(screen.getByText("Text")).toHaveClass(expected);
    },
  );

  it.each([
    { color: "default" as const, expected: "text-muted-foreground" },
    { color: "muted" as const, expected: "text-muted-foreground" },
    { color: "foreground" as const, expected: "text-foreground" },
    { color: "accent" as const, expected: "text-primary" },
  ])(
    "renders $color color with class $expected",
    ({ color, expected }) => {
      render(<Typography color={color}>Text</Typography>);
      expect(screen.getByText("Text")).toHaveClass(expected);
    },
  );

  it("renders truncate class when truncate is true", () => {
    render(<Typography truncate>Truncated text</Typography>);
    expect(screen.getByText("Truncated text")).toHaveClass("truncate");
  });

  it("does not render truncate class by default", () => {
    render(<Typography>Normal text</Typography>);
    expect(screen.getByText("Normal text")).not.toHaveClass("truncate");
  });

  it.each([
    { as: "h1" as const, level: 1 },
    { as: "h2" as const, level: 2 },
    { as: "h3" as const, level: 3 },
    { as: "h4" as const, level: 4 },
    { as: "h5" as const, level: 5 },
    { as: "h6" as const, level: 6 },
  ])(
    "$as auto-defaults to bold weight",
    ({ as, level }) => {
      render(<Typography as={as}>Heading</Typography>);
      expect(screen.getByRole("heading", { level })).toHaveClass("font-bold");
    },
  );

  it("explicit weight overrides heading auto-default", () => {
    render(
      <Typography as="h1" weight="medium">
        Override
      </Typography>,
    );

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveClass("font-medium");
    expect(heading).not.toHaveClass("font-bold");
  });
});
