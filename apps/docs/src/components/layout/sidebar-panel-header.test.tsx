// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SidebarPanelHeaderRow } from "./sidebar-panel-header";

describe("SidebarPanelHeaderRow", () => {
  it("forwards native div attributes such as aria-busy to the DOM", () => {
    render(
      <SidebarPanelHeaderRow role="group" aria-label="Panel row" aria-busy={true}>
        Row content
      </SidebarPanelHeaderRow>,
    );

    const row = screen.getByRole("group", { name: "Panel row" });
    expect(row).toHaveAttribute("aria-busy", "true");
    expect(row).toHaveTextContent("Row content");
  });
});
