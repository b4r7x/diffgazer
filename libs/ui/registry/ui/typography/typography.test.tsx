import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";
import { Typography, typographyVariants } from "./index";

/**
 * Classes the exported public variant contract produces, merged the way the component merges
 * them — never hand-written Tailwind names. Merging matters: a `size` utility carries a line
 * height, so it wins over the `variant` leading class that precedes it.
 */
function variantClasses(...args: Parameters<typeof typographyVariants>) {
  return cn(typographyVariants(...args)).split(" ");
}

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
    { as: "h1" as const, level: 1 },
    { as: "h2" as const, level: 2 },
    { as: "h3" as const, level: 3 },
    { as: "h4" as const, level: 4 },
    { as: "h5" as const, level: 5 },
    { as: "h6" as const, level: 6 },
  ])("renders $as as a semantic heading", ({ as, level }) => {
    render(<Typography as={as}>Heading {level}</Typography>);

    const heading = screen.getByRole("heading", { level });
    expect(heading).toBeInTheDocument();
    expect(heading.tagName).toBe(as.toUpperCase());
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

  it("forwards consumer DOM attributes", () => {
    render(<Typography id="body-copy">Body copy</Typography>);

    expect(screen.getByText("Body copy")).toHaveAttribute("id", "body-copy");
  });
});

describe("Typography variant resolution", () => {
  it("resolves typographyVariants() with no arguments to the documented defaults", () => {
    expect(typographyVariants({})).toBe(
      typographyVariants({
        variant: "default",
        size: "sm",
        weight: "normal",
        color: "default",
        truncate: false,
      }),
    );
  });

  it.each([
    { as: "h1" as const, level: 1, size: "3xl" as const },
    { as: "h2" as const, level: 2, size: "2xl" as const },
    { as: "h3" as const, level: 3, size: "xl" as const },
    { as: "h4" as const, level: 4, size: "lg" as const },
    { as: "h5" as const, level: 5, size: "base" as const },
    { as: "h6" as const, level: 6, size: "sm" as const },
  ])("styles $as with its default size and a bold weight", ({ as, level, size }) => {
    render(<Typography as={as}>Heading</Typography>);

    expect(screen.getByRole("heading", { level })).toHaveClass(
      ...variantClasses({ size, weight: "bold" }),
    );
  });

  it("keeps the base defaults for non-heading elements", () => {
    render(<Typography as="p">Body copy</Typography>);

    expect(screen.getByText("Body copy")).toHaveClass(...variantClasses({}));
  });

  it("lets explicit size and weight props override the heading defaults", () => {
    render(
      <Typography as="h1" size="xs" weight="normal">
        Heading
      </Typography>,
    );

    expect(screen.getByRole("heading", { level: 1 })).toHaveClass(
      ...variantClasses({ size: "xs", weight: "normal" }),
    );
    expect(screen.getByRole("heading", { level: 1 })).not.toHaveClass(
      ...variantClasses({ size: "3xl" }).filter(
        (className) => !variantClasses({ size: "xs" }).includes(className),
      ),
    );
  });

  it("applies the remaining variant axes through the exported contract", () => {
    render(
      <Typography variant="prose" color="muted" lineClamp={3} truncate>
        Body copy
      </Typography>,
    );

    expect(screen.getByText("Body copy")).toHaveClass(
      ...variantClasses({ variant: "prose", color: "muted", lineClamp: 3, truncate: true }),
    );
  });
});
