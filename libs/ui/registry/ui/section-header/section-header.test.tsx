import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "../../../testing/axe";
import { SectionHeader } from "./index";

describe("SectionHeader", () => {
  it("renders the requested heading level", () => {
    render(<SectionHeader as="h2">Review summary</SectionHeader>);

    expect(screen.getByRole("heading", { level: 2, name: "Review summary" })).toBeInTheDocument();
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
