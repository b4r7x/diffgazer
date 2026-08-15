import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ThemeProvider } from "@/hooks/theme-context";
import { CssOutput } from "./css-output";

describe("CssOutput", () => {
  it("emits theme-scoped selectors that match libs/ui theme.css", () => {
    render(
      <ThemeProvider>
        <CssOutput
          theme="dark"
          primitives={{ "--base-bg": "#111111" }}
          defaults={{ "--base-bg": "#0a0a0a" }}
        />
      </ThemeProvider>,
    );

    expect(screen.getByText(":root,")).toBeInTheDocument();
    expect(screen.getByText('[data-theme="dark"] {')).toBeInTheDocument();
    expect(screen.queryByText(":root {")).not.toBeInTheDocument();
  });

  it("scopes light-theme overrides to the light palette selector", () => {
    render(
      <ThemeProvider>
        <CssOutput
          theme="light"
          primitives={{ "--base-bg": "#ffffff" }}
          defaults={{ "--base-bg": "#f7f8f5" }}
        />
      </ThemeProvider>,
    );

    expect(screen.getByText('[data-theme="light"] {')).toBeInTheDocument();
  });
});
