// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SectionHeading } from "./section-heading";

describe("SectionHeading", () => {
  it("keeps the prompt marker out of the heading text so TOC labels stay clean", () => {
    render(<SectionHeading id="api-reference">API Reference</SectionHeading>);

    const heading = screen.getByRole("heading", { level: 2, name: "API Reference" });
    expect(heading).toHaveAttribute("id", "api-reference");
    expect(heading.textContent).toBe("API Reference");
  });

  it("renders an end-slot action outside the heading element", () => {
    render(
      <SectionHeading id="source" action={<button type="button">[Copy]</button>}>
        Source
      </SectionHeading>,
    );

    const heading = screen.getByRole("heading", { level: 2, name: "Source" });
    const action = screen.getByRole("button", { name: "[Copy]" });

    expect(heading.textContent).toBe("Source");
    expect(heading).not.toContainElement(action);
  });
});
