import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/hooks/theme-context";
import {
  THEME_DOCS_COLOR_GRID_ORDER,
  THEME_DOCS_COLOR_GROUPS,
  THEME_DOCS_TOKENS,
} from "../lib/token-presentation";
import { ColorGrid } from "./color-grid";

function renderColorGrid() {
  return render(
    <ThemeProvider>
      <ColorGrid />
    </ThemeProvider>,
  );
}

/** The swatch's status region, mounted (and empty) from first paint. */
function liveRegionOf(swatchButton: HTMLElement): HTMLElement {
  const region = swatchButton.querySelector('[aria-live="polite"]');
  if (!(region instanceof HTMLElement)) throw new Error("Swatch has no live status region");
  return region;
}

function tokenNamesInVisualOrder(container: HTMLElement): string[] {
  return within(container)
    .getAllByRole("button")
    .map((button) => within(button).getByText(/^--/).textContent ?? "");
}

const sampleSwatch = THEME_DOCS_COLOR_GROUPS[0]?.tokens[0];
if (!sampleSwatch) {
  throw new Error("Theme docs color groups fixture is missing a swatch");
}

describe("ColorGrid", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders every documented theme token", () => {
    renderColorGrid();

    expect(screen.getAllByRole("button", { name: /Copy --/i })).toHaveLength(
      THEME_DOCS_TOKENS.length,
    );

    for (const token of THEME_DOCS_TOKENS) {
      expect(screen.getByText(token.name)).toBeInTheDocument();
    }

    const primitives = screen.getByRole("region", { name: "Primitives" });
    expect(tokenNamesInVisualOrder(primitives)).toEqual([...THEME_DOCS_COLOR_GRID_ORDER]);
  });

  it("copies the swatch CSS variable and shows success feedback", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();

    renderColorGrid();

    const swatchButton = screen.getByRole("button", {
      name: `Copy ${sampleSwatch.name} CSS variable`,
    });
    await user.click(swatchButton);

    expect(writeText).toHaveBeenCalledWith(`var(${sampleSwatch.name})`);
    await waitFor(() => expect(liveRegionOf(swatchButton)).toHaveTextContent("Copied!"));
    // The control keeps its identity while it reports the result.
    expect(swatchButton).toHaveAccessibleName(`Copy ${sampleSwatch.name} CSS variable`);
  });

  it("shows accessible feedback when clipboard copy fails", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));

    renderColorGrid();

    const swatchButton = screen.getByRole("button", {
      name: `Copy ${sampleSwatch.name} CSS variable`,
    });
    // The region exists and is empty before the copy, so assistive technology has
    // it registered by the time the failure text lands in it.
    const status = liveRegionOf(swatchButton);
    expect(status).toBeEmptyDOMElement();

    await user.click(swatchButton);

    await waitFor(() => expect(status).toHaveTextContent("Copy failed"));
    expect(swatchButton).toHaveAccessibleName(`Copy ${sampleSwatch.name} CSS variable`);
  });
});
