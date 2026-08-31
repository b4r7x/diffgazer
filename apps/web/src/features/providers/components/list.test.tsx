import {
  buildProviderRows,
  configurationStatus,
  makeClientNotice,
  OPENCODE_GO_CONFIGURATION,
  ZAI_CONFIGURATION,
} from "@diffgazer/core/testing/provider-fixtures";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { filterProviders } from "../lib/filter";
import { ProviderList } from "./list";

const ROWS = filterProviders(buildProviderRows(), "all");
const GEMINI_ROW = ROWS.find((row) => row.configuration?.configurationId === "gemini-primary");
if (!GEMINI_ROW) throw new Error("Missing gemini fixture");

// OpenRouter is the one bounded product whose picker really does sell both
// halves, so it is where a per-model FREE badge can be proven against a row.
function openrouterRow(selectedModelId: string) {
  const row = buildProviderRows([
    configurationStatus(
      {
        configurationId: "openrouter-primary",
        revision: 1,
        status: "supported",
        transportFamily: "hosted-api",
        productId: "openrouter",
        endpoint: "https://openrouter.ai/api/v1",
        selectedModelId,
        notices: [makeClientNotice("openrouter")],
        availableActions: ["inspect", "select", "test", "update", "delete"],
      },
      "ready",
    ),
  ]).find(({ configuration }) => configuration?.configurationId === "openrouter-primary");
  if (!row) throw new Error("Missing openrouter fixture");
  return row;
}

const DEFAULT_LIST_PROPS = {
  unrecognized: [],
  selectedId: "gemini-primary",
  onSelect: vi.fn(),
  filter: "all" as const,
  onFilterChange: vi.fn(),
  searchQuery: "",
  onSearchChange: vi.fn(),
};

function goBoundRow() {
  const row = buildProviderRows([configurationStatus(OPENCODE_GO_CONFIGURATION, "ready")]).find(
    ({ configuration }) => configuration?.configurationId === "opencode-go",
  );
  if (!row) throw new Error("Missing opencode-go fixture");
  return row;
}

describe("ProviderList", () => {
  // The wallet, not the product, is what the user bound, so the row names it.
  it("names a configured dual-pool row by the pool its runs will bill", () => {
    render(<ProviderList providers={[goBoundRow()]} {...DEFAULT_LIST_PROPS} />);

    expect(screen.getByRole("option", { name: "OpenCode · Go" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "OpenCode Zen" })).not.toBeInTheDocument();
  });

  // The badge answers for the selected model, and the catalog display name
  // leads the exact id rather than replacing it.
  it("exposes the selected model's own tier, display name, and id as the option description", () => {
    render(
      <ProviderList
        providers={[openrouterRow("anthropic/claude-opus-4.8")]}
        {...DEFAULT_LIST_PROPS}
      />,
    );

    const option = screen.getByRole("option", { name: "OpenRouter" });

    expect(option).toHaveAccessibleDescription("PAID Claude Opus 4.8 anthropic/claude-opus-4.8");
  });

  // A genuinely zero-priced route: the badge is the model's own list price, not
  // the product's mixed range, so FREE here is a fact the catalog published.
  it("badges a zero-priced route FREE on the strength of its own catalog price", () => {
    render(
      <ProviderList
        providers={[openrouterRow("nvidia/nemotron-3-super-120b-a12b:free")]}
        {...DEFAULT_LIST_PROPS}
      />,
    );

    expect(screen.getByRole("option", { name: "OpenRouter" })).toHaveAccessibleDescription(
      "FREE Nemotron 3 Super (free) nvidia/nemotron-3-super-120b-a12b:free",
    );
  });

  // Gemini's selected model carries a list price, but Google's free tier is a
  // fact about the account that price cannot restate — so the product keeps
  // answering and the row does not flip to PAID on selection.
  it("keeps a declared free tier on a configured row whose model is priced", () => {
    render(<ProviderList providers={[GEMINI_ROW]} {...DEFAULT_LIST_PROPS} />);

    expect(screen.getByRole("option", { name: "Google Gemini" })).toHaveAccessibleDescription(
      "FREE QUOTA Gemini 2.5 Flash gemini-2.5-flash",
    );
  });

  it("publishes the display-status tone on each status chip", () => {
    const modelMissingRow = buildProviderRows([
      configurationStatus(ZAI_CONFIGURATION, "model-missing"),
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
      "FREE QUOTA Gemini 2.5 Flash gemini-2.5-flash",
    );
  });

  // A record this build could not decode has no product, model, or readiness to
  // name; the row exists so the user can find it and remove it.
  it("lists a record this build could not decode by its id", () => {
    render(
      <ProviderList
        {...DEFAULT_LIST_PROPS}
        providers={[GEMINI_ROW]}
        unrecognized={[{ configurationId: "cfg-retired" }]}
      />,
    );

    const option = screen.getByRole("option", { name: "Unrecognized configuration" });

    expect(option).toHaveAccessibleDescription("cfg-retired");
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
