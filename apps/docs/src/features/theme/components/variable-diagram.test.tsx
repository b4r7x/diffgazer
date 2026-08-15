import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ThemeProvider } from "@/hooks/theme-context";
import { THEME_DOCS_MAPPED_PRIMITIVES } from "../lib/token-presentation";
import { VariableDiagram } from "./variable-diagram";

describe("VariableDiagram", () => {
  it("exposes primitive-to-semantic mappings to assistive technology", () => {
    render(
      <ThemeProvider>
        <VariableDiagram />
      </ThemeProvider>,
    );

    const description = screen.getByText(
      THEME_DOCS_MAPPED_PRIMITIVES.flatMap((primitive) =>
        primitive.semanticTokens.dark.map(
          (semanticToken) => `${primitive.name} feeds ${semanticToken}`,
        ),
      ).join("; "),
      { selector: ".sr-only" },
    );

    expect(description).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
