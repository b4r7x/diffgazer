import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { Typography } from "./index";

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
