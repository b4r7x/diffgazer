import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { GlobalShortcutsDemo } from "../../examples/playground/src/demos/global-shortcuts";
import { KeyboardWrapper } from "../testing/test-utils.js";

vi.mock("@diffgazer/keys", () => import("../index.js"));

describe("GlobalShortcutsDemo", () => {
  it("toggles and closes Global Shortcuts while its search input owns focus", async () => {
    const user = userEvent.setup();
    render(<GlobalShortcutsDemo />, { wrapper: KeyboardWrapper });

    await user.keyboard("{Control>}k{/Control}");
    const search = screen.getByPlaceholderText("Search...");
    expect(document.activeElement).toBe(search);

    await user.keyboard("/");
    expect(search).toHaveProperty("value", "/");
    expect(screen.getByText("Last action: Toggled search bar")).toBeTruthy();

    await user.keyboard("{Control>}k{/Control}");
    expect(screen.queryByPlaceholderText("Search...")).toBeNull();

    await user.keyboard("{Control>}k{/Control}");
    expect(document.activeElement).toBe(screen.getByPlaceholderText("Search..."));
    await user.keyboard("{Escape}");

    expect(screen.queryByPlaceholderText("Search...")).toBeNull();
  });
});
