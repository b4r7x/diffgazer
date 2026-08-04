// @vitest-environment jsdom

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

function primitiveNamesFromCopyButtons(container: HTMLElement): string[] {
  return within(container)
    .getAllByRole("button")
    .map((button) => {
      const match = (button.getAttribute("aria-label") ?? "").match(/Copy (--[a-z0-9-]+)/);
      return match?.[1];
    })
    .filter((name): name is string => name !== undefined);
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

    const primitivesSection = screen.getByRole("heading", { name: "Primitives" }).parentElement;
    if (primitivesSection === null) throw new Error("Primitives heading has no parent section");
    expect(primitiveNamesFromCopyButtons(primitivesSection)).toEqual([
      ...THEME_DOCS_COLOR_GRID_ORDER,
    ]);
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
    await waitFor(() => expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument());
  });

  it("shows accessible feedback when clipboard copy fails", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));

    renderColorGrid();

    const swatchButton = screen.getByRole("button", {
      name: `Copy ${sampleSwatch.name} CSS variable`,
    });
    await user.click(swatchButton);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Copy failed" })).toBeInTheDocument(),
    );
    expect(screen.getByText("Copy failed")).toBeInTheDocument();
  });
});
