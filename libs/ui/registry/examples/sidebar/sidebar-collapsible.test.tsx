import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import SidebarCollapsible from "./sidebar-collapsible";

describe("sidebar-collapsible example", () => {
  afterEach(() => {
    window.history.replaceState(null, "", window.location.pathname);
  });

  it("keeps navigation rows in the Tab sequence and activates them", async () => {
    const user = userEvent.setup();
    render(<SidebarCollapsible />);

    await user.tab();
    expect(screen.getByRole("button", { name: "src/" })).toHaveFocus();

    await user.tab();
    const link = screen.getByRole("link", { name: "index.ts" });
    expect(link).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(window.location.hash).toBe("#src-index");
  });
});
