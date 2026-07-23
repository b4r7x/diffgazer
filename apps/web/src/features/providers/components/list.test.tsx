import type { ProviderWithStatus } from "@diffgazer/core/schemas/config";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProviderList } from "./list";

const TEST_PROVIDERS: ProviderWithStatus[] = [
  {
    id: "gemini",
    name: "Google Gemini",
    defaultModel: "gemini-2.5-flash",
    hasApiKey: false,
    isActive: false,
    model: "gemini-2.5-flash",
    displayStatus: "needs-key",
  },
];

const DEFAULT_LIST_PROPS = {
  selectedId: "gemini",
  onSelect: vi.fn(),
  filter: "all" as const,
  onFilterChange: vi.fn(),
  searchQuery: "",
  onSearchChange: vi.fn(),
};

describe("ProviderList", () => {
  it("exposes provider badge and model as the option description", () => {
    render(<ProviderList providers={TEST_PROVIDERS} {...DEFAULT_LIST_PROPS} />);

    const option = screen.getByRole("option", { name: "Google Gemini" });

    expect(option).toHaveAccessibleDescription("FREE gemini-2.5-flash");
  });

  it("keeps the same live status node when filtering removes every provider", () => {
    const { rerender } = render(
      <ProviderList providers={TEST_PROVIDERS} {...DEFAULT_LIST_PROPS} />,
    );
    const liveRegion = screen.getByRole("status");

    expect(liveRegion).toHaveTextContent("");
    expect(liveRegion).toHaveClass("sr-only");

    rerender(<ProviderList providers={[]} {...DEFAULT_LIST_PROPS} />);

    expect(screen.getByRole("status")).toBe(liveRegion);
    expect(liveRegion).toHaveTextContent("No providers match your filters");
    expect(liveRegion).not.toHaveClass("sr-only");
  });
});
