// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SidebarPanelHeaderRow } from "./sidebar-panel-header";

describe("SidebarPanelHeaderRow", () => {
  it("forwards native div attributes such as aria-busy to the DOM", () => {
    render(
      <SidebarPanelHeaderRow aria-busy={true} data-testid="row">
        Row content
      </SidebarPanelHeaderRow>,
    );

    expect(screen.getByTestId("row")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByTestId("row")).toHaveTextContent("Row content");
  });
});
