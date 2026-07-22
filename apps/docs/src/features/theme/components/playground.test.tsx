// @vitest-environment jsdom

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ThemeProvider } from "@/hooks/theme-context";
import { ThemePlayground } from "./playground";

function renderPlayground() {
  return render(
    <ThemeProvider>
      <ThemePlayground />
    </ThemeProvider>,
  );
}

describe("ThemePlayground panel headers", () => {
  it.each([
    "Primitives",
    "Preview",
    "Generated CSS",
  ])("names the %s region by its level-3 heading", (name) => {
    renderPlayground();
    const region = screen.getByRole("region", { name });
    expect(within(region).getByRole("heading", { name, level: 3 })).toBeInTheDocument();
  });

  it("associates the Reset action with the Primitives panel", () => {
    renderPlayground();
    const region = screen.getByRole("region", { name: "Primitives" });
    expect(within(region).getByRole("button", { name: "Reset" })).toBeInTheDocument();
  });

  it("demonstrates correct Panel usage in the preview with a titled panel", () => {
    renderPlayground();
    expect(screen.getByRole("heading", { name: "Panel Title", level: 4 })).toBeInTheDocument();
  });
});
