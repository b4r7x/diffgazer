import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./index.js";

describe("EmptyState", () => {
  it("renders children without a live region by default", () => {
    render(<EmptyState>No results</EmptyState>);

    expect(screen.getByText("No results")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("renders live empty-state content immediately", () => {
    render(<EmptyState live>No results</EmptyState>);

    expect(screen.getByRole("status")).toHaveTextContent("No results");
  });
});
