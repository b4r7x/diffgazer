import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import CardInteractiveExample from "./card-interactive";

describe("card interactive example", () => {
  it("exposes only the live cards as links and a button, leaving the forced-state swatches inert", () => {
    render(<CardInteractiveExample />);

    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual([
      expect.stringContaining("Flat Interactive"),
      expect.stringContaining("Stacked Interactive"),
      expect.stringContaining("Inset Interactive"),
      expect.stringContaining("Dotted Interactive"),
    ]);
    expect(screen.getByRole("button", { name: /Glow Interactive/ })).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });
});
