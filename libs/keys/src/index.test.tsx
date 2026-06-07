import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  getNavigationItemProps,
  KeyboardProvider,
  useFocusRestore,
  useKey,
  useNavigation,
} from "./index.js";

describe("public package surface", () => {
  it("exports the primary hooks and navigation helpers from the root entry", async () => {
    const onSelect = vi.fn();

    function Harness() {
      const listRef = useRef<HTMLDivElement>(null);
      const { onKeyDown, highlighted } = useNavigation<"one" | "two">({
        containerRef: listRef,
        role: "option",
        defaultHighlighted: "one",
        onSelect,
      });
      const focusRestore = useFocusRestore({ restoreOnUnmount: false });
      useKey("Escape", () => focusRestore.capture());

      return (
        <div>
          <div ref={listRef} role="listbox" aria-label="Items" onKeyDown={onKeyDown} tabIndex={0}>
            <div
              role="option"
              aria-selected={highlighted === "one"}
              {...getNavigationItemProps("option", "one")}
            >
              One
            </div>
            <div
              role="option"
              aria-selected={highlighted === "two"}
              {...getNavigationItemProps("option", "two")}
            >
              Two
            </div>
          </div>
          <output aria-label="Captured focus">
            {focusRestore.target?.getAttribute("aria-label") ?? "none"}
          </output>
        </div>
      );
    }

    render(
      <KeyboardProvider>
        <Harness />
      </KeyboardProvider>,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("listbox", { name: "Items" }));
    await user.keyboard("{ArrowDown} {Escape}");

    expect(screen.getByRole("option", { name: "Two" }).getAttribute("aria-selected")).toBe("true");
    expect(onSelect).toHaveBeenCalledWith("two", expect.any(KeyboardEvent));
    expect(screen.getByLabelText("Captured focus").textContent).toBe("Items");
  });
});
