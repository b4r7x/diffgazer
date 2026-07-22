// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { type ComponentPageData, DocDataProvider } from "@/components/docs-mdx/doc-data-context";
import { APIReference } from "./api-reference";

const componentData = {
  name: "reference-table-test",
  title: "Reference table test",
  description: "",
  dependencies: [],
  files: [],
  props: {},
  usageSnippet: "",
  usageSnippetHighlighted: [],
  examples: [],
  exampleSource: {},
  docs: {
    dataAttributes: [
      {
        attribute: "data-state",
        appliesTo: "Root",
        values: '"open" | "closed"',
        description: "Current state.",
      },
    ],
    cssVariables: [
      {
        name: "--panel-width",
        defaultValue: "20rem",
        description: "Panel width.",
      },
    ],
  },
} satisfies ComponentPageData;

describe("APIReference", () => {
  it("exposes each reference table as a heading-labelled, keyboard-focusable region", async () => {
    const user = userEvent.setup();
    render(
      <DocDataProvider value={{ type: "component", data: componentData }}>
        <APIReference />
      </DocDataProvider>,
    );

    const dataAttributesHeading = screen.getByRole("heading", {
      level: 3,
      name: "Data attributes",
    });
    const cssVariablesHeading = screen.getByRole("heading", {
      level: 3,
      name: "CSS variables",
    });
    const dataAttributesRegion = screen.getByRole("region", { name: "Data attributes" });
    const cssVariablesRegion = screen.getByRole("region", { name: "CSS variables" });

    expect(dataAttributesRegion).toHaveAttribute("aria-labelledby", dataAttributesHeading.id);
    expect(cssVariablesRegion).toHaveAttribute("aria-labelledby", cssVariablesHeading.id);
    expect(within(dataAttributesRegion).getByRole("table")).toBeInTheDocument();
    expect(within(cssVariablesRegion).getByRole("table")).toBeInTheDocument();

    const dataAttributesRow = within(dataAttributesRegion).getAllByRole("row")[1];
    if (!dataAttributesRow) throw new Error("Expected a data-attributes data row");
    expect(within(dataAttributesRow).getByRole("cell", { name: "data-state" })).toBeInTheDocument();
    expect(within(dataAttributesRow).getByRole("cell", { name: "Root" })).toBeInTheDocument();
    expect(
      within(dataAttributesRow).getByRole("cell", { name: '"open" | "closed"' }),
    ).toBeInTheDocument();
    expect(
      within(dataAttributesRow).getByRole("cell", { name: "Current state." }),
    ).toBeInTheDocument();

    const cssVariablesRow = within(cssVariablesRegion).getAllByRole("row")[1];
    if (!cssVariablesRow) throw new Error("Expected a CSS-variables data row");
    expect(
      within(cssVariablesRow).getByRole("cell", { name: "--panel-width" }),
    ).toBeInTheDocument();
    expect(within(cssVariablesRow).getByRole("cell", { name: "20rem" })).toBeInTheDocument();
    expect(within(cssVariablesRow).getByRole("cell", { name: "Panel width." })).toBeInTheDocument();

    await user.tab();
    expect(dataAttributesRegion).toHaveFocus();
    await user.tab();
    expect(cssVariablesRegion).toHaveFocus();
  });
});
