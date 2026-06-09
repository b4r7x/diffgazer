// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { LegalPageLayout } from "./legal-page-layout";

vi.mock("@/components/layout/tui-two-pane", () => ({
  TuiTwoPane: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

describe("LegalPageLayout", () => {
  it("renders the panel label and child content", () => {
    render(
      <LegalPageLayout panelLabel="PRIVACY">
        <h1>Privacy policy</h1>
      </LegalPageLayout>,
    );

    expect(screen.getByText("[ LEGAL / PRIVACY ]")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Privacy policy" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
  });
});
