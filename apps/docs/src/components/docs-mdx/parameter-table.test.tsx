// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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
    for (const label of ["Prop", "Type", "Default", "Description"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });
});
