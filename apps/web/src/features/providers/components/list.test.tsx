import {
  buildProviderRows,
  configurationStatus,
  READY_ZAI_CONFIGURATION,
} from "@diffgazer/core/testing/provider-fixtures";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { filterProviders } from "../lib/filter";
import { ProviderList } from "./list";

const ROWS = filterProviders(buildProviderRows(), "all");
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

  it("publishes the display-status tone on each status chip", () => {
    const modelMissingRow = buildProviderRows([
      configurationStatus(READY_ZAI_CONFIGURATION, "model-missing"),
    ]).find((row) => row.configuration?.configurationId === "zai-primary");
    if (!modelMissingRow) throw new Error("Missing model-missing fixture");

    render(<ProviderList providers={[GEMINI_ROW, modelMissingRow]} {...DEFAULT_LIST_PROPS} />);

    expect(screen.getByRole("img", { name: /^Ready\./ })).toHaveAttribute("data-tone", "success");
    expect(screen.getByRole("img", { name: /^Model missing\./ })).toHaveAttribute(
      "data-tone",
      "warning",
    );
  });

  it("keeps row subtitles free of remediation prose", () => {
    render(<ProviderList providers={ROWS} {...DEFAULT_LIST_PROPS} />);

    for (const row of ROWS) {
      expect(screen.queryByText(row.readiness.remediation.message)).not.toBeInTheDocument();
    }
    expect(screen.getByRole("option", { name: "Google Gemini" })).toHaveAccessibleDescription(
      "FREE gemini-2.5-flash",
    );
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
