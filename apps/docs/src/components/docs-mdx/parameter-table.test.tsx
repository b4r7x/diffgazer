// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReturnsTable } from "./blocks/returns-table";
import { DocDataProvider, type HookPageData } from "./doc-data-context";
import { ParameterTable } from "./parameter-table";

const params = [
  {
    name: "open",
    type: "boolean",
    required: true,
    defaultValue: "false",
    description: "Controls visibility.",
  },
  {
    name: "label",
    type: '"start" | "end"',
    defaultValue: null,
    description: "Where the label sits.",
  },
];

const hookData = {
  name: "useExample",
  title: "Use Example",
  description: "Example hook.",
  docs: {
    returns: {
      type: "ExampleState",
      description: "The current example state.",
      properties: [
        {
          name: "value",
          type: "string",
          required: true,
          description: "Current value.",
        },
        {
          name: "reset",
          type: "() => void",
          required: false,
          description: "Resets the value.",
          defaultValue: "undefined",
        },
      ],
    },
  },
  examples: [],
  exampleSource: {},
} satisfies HookPageData;

describe("ParameterTable", () => {
  it("renders each prop name, type, default, and description as queryable text", () => {
    render(<ParameterTable params={params} />);

    expect(screen.getByText("open")).toBeInTheDocument();
    expect(screen.getByText("label")).toBeInTheDocument();
    expect(screen.getByText("boolean")).toBeInTheDocument();
    expect(screen.getByText('"start" | "end"')).toBeInTheDocument();
    expect(screen.getByText("false")).toBeInTheDocument();
    expect(screen.getByText("Controls visibility.")).toBeInTheDocument();
    expect(screen.getByText("Where the label sits.")).toBeInTheDocument();
  });

  it("marks required props with a required badge", () => {
    render(<ParameterTable params={params} />);
    expect(screen.getByText("required")).toBeInTheDocument();
  });

  it("shows an em-dash placeholder when a prop has no default", () => {
    render(<ParameterTable params={params} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("labels the columns for the desktop layout", () => {
    render(<ParameterTable params={params} />);
    for (const label of ["Name", "Type", "Default", "Description"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("uses one semantic table for every parameter", () => {
    render(<ParameterTable params={params} />);

    const table = screen.getByRole("table");
    const headers = within(table).getAllByRole("columnheader");
    expect(headers.map((header) => header.textContent)).toEqual([
      "Name",
      "Type",
      "Default",
      "Description",
    ]);
    for (const header of headers) {
      expect(header).toHaveAttribute("scope", "col");
    }

    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(params.length + 1);
    for (const row of rows.slice(1)) {
      expect(within(row).getAllByRole("cell")).toHaveLength(4);
    }

    expect(screen.getByRole("columnheader", { name: "Description" })).toBeVisible();
  });

  it("renders return properties in the same semantic table", () => {
    render(
      <DocDataProvider value={{ type: "hook", data: hookData }}>
        <ReturnsTable />
      </DocDataProvider>,
    );

    const table = screen.getByRole("table");
    const headers = within(table).getAllByRole("columnheader");
    expect(headers.map((header) => header.textContent)).toEqual([
      "Name",
      "Type",
      "Default",
      "Description",
    ]);
    const cells = within(table).getAllByRole("cell");
    expect(cells).toHaveLength(8);
    expect(cells[0]?.textContent).toContain("value");
    expect(cells[1]?.textContent).toBe("string");
    expect(cells[4]?.textContent).toBe("reset");
    expect(cells[5]?.textContent).toBe("() => void");
  });
});
