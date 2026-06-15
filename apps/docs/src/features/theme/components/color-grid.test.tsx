// @vitest-environment jsdom

import { THEME_DOCS_COLOR_GROUPS } from "@diffgazer/ui/theme";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/hooks/theme-context";
import { ColorGrid } from "./color-grid";

function renderColorGrid() {
  return render(
    <ThemeProvider>
      <ColorGrid />
    </ThemeProvider>,
  );
}

const sampleSwatch = THEME_DOCS_COLOR_GROUPS[0]?.tokens[0];
if (!sampleSwatch) {
  throw new Error("Theme docs color groups fixture is missing a swatch");
}

describe("ColorGrid", () => {
  afterEach(() => {
    vi.restoreAllMocks();
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
