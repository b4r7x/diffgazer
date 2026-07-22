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
  it("uses one semantic table with each row's values, the required badge, and the em-dash placeholder", () => {
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

    const openRow = within(table).getByRole("row", { name: /^open/ });
    const [openName, openType, openDefault, openDescription] = within(openRow).getAllByRole("cell");
    expect(openName).toHaveTextContent("open");
    expect(openType).toHaveTextContent("boolean");
    expect(openDefault).toHaveTextContent("false");
    expect(openDescription).toHaveTextContent("Controls visibility.");
    expect(within(openRow).getByText("required")).toBeInTheDocument();

    const labelRow = within(table).getByRole("row", { name: /^label/ });
    const [labelName, labelType, labelDefault, labelDescription] =
      within(labelRow).getAllByRole("cell");
    expect(labelName).toHaveTextContent("label");
    expect(labelType).toHaveTextContent('"start" | "end"');
    expect(labelDefault).toHaveTextContent("—");
    expect(labelDescription).toHaveTextContent("Where the label sits.");
    expect(within(labelRow).queryByText("required")).not.toBeInTheDocument();
  });

  it("renders return type, description, and property names and types as queryable text", () => {
    render(
      <DocDataProvider value={{ type: "hook", data: hookData }}>
        <ReturnsTable />
      </DocDataProvider>,
    );

    expect(screen.getByText("ExampleState")).toBeInTheDocument();
    expect(screen.getByText("The current example state.")).toBeInTheDocument();
    expect(screen.getByText("value")).toBeInTheDocument();
    expect(screen.getByText("string")).toBeInTheDocument();
    expect(screen.getByText("reset")).toBeInTheDocument();
    expect(screen.getByText("() => void")).toBeInTheDocument();
  });
});
