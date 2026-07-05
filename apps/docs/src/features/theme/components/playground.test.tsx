// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
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
  it("renders each panel title as a heading in the header", () => {
    renderPlayground();
    expect(screen.getByRole("heading", { name: "Primitives", level: 3 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Preview", level: 3 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Generated CSS", level: 3 })).toBeInTheDocument();
  });

  it("keeps the Reset action in the Primitives header", () => {
    renderPlayground();
    expect(screen.getByRole("button", { name: "Reset" })).toBeInTheDocument();
  });

  it("names each panel region by its title", () => {
    renderPlayground();
    expect(screen.getByRole("region", { name: "Primitives" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Generated CSS" })).toBeInTheDocument();
  });

  it("demonstrates correct Panel usage in the preview with a titled panel", () => {
    renderPlayground();
    expect(screen.getByRole("heading", { name: "Panel Title", level: 4 })).toBeInTheDocument();
  });
});
