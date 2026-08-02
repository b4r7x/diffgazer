import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { buildProviderRows } from "../testing/fixtures";
import { ProviderList } from "./list";

const ROWS = buildProviderRows();
const GEMINI_ROW = ROWS.find((row) => row.configuration?.configurationId === "gemini-primary");
if (!GEMINI_ROW) throw new Error("Missing gemini fixture");

const DEFAULT_LIST_PROPS = {
  selectedId: "gemini-primary",
  onSelect: vi.fn(),
  filter: "all" as const,
  onFilterChange: vi.fn(),
  searchQuery: "",
  onSearchChange: vi.fn(),
};

describe("ProviderList", () => {
  it("exposes product badge and model as the option description", () => {
    render(<ProviderList providers={[GEMINI_ROW]} {...DEFAULT_LIST_PROPS} />);

    const option = screen.getByRole("option", { name: "Google Gemini" });

    expect(option).toHaveAccessibleDescription("FREE gemini-2.5-flash");
  });

  it("marks removed records as non-selectable with removed status text", () => {
    const removedRow = ROWS.find(
      (row) => row.configuration?.configurationId === "legacy-removed-zai-plan",
    );
    if (!removedRow) throw new Error("Missing removed fixture");

    render(<ProviderList providers={[removedRow]} {...DEFAULT_LIST_PROPS} selectedId={null} />);

    expect(screen.getByRole("option", { name: "Z.AI Coding Plan" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByLabelText(/Removed\./i)).toBeInTheDocument();
  });

  it("keeps the same live status node when filtering removes every provider", () => {
    const { rerender } = render(<ProviderList providers={[GEMINI_ROW]} {...DEFAULT_LIST_PROPS} />);
    const liveRegion = screen.getByRole("status");

    expect(liveRegion).toHaveTextContent("");
    expect(liveRegion).toHaveClass("sr-only");

    rerender(<ProviderList providers={[]} {...DEFAULT_LIST_PROPS} />);

    expect(screen.getByRole("status")).toBe(liveRegion);
    expect(liveRegion).toHaveTextContent("No providers match your filters");
    expect(liveRegion).not.toHaveClass("sr-only");
  });
});
