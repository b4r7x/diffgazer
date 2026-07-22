import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "../../../testing/axe";
import { SectionHeader } from "./index";

describe("SectionHeader", () => {
  it.each([
    { label: "omitted as", as: undefined, level: 3 },
    { label: "explicit as='h2'", as: "h2" as const, level: 2 },
  ])("renders heading level $level when $label", ({ as, level }) => {
    render(<SectionHeader as={as}>Review summary</SectionHeader>);

    expect(screen.getByRole("heading", { level, name: "Review summary" })).toBeInTheDocument();
  });

  it("has no a11y violations", async () => {
    const { container } = render(
      <section aria-labelledby="changes-heading">
        <SectionHeader id="changes-heading" as="h2" bordered>
          Changes
        </SectionHeader>
        <p>Files changed in this review.</p>
      </section>,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
