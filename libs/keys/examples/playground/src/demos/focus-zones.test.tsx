import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { KeyboardWrapper } from "../testing/keyboard-wrapper";
import { FocusZonesDemo } from "./focus-zones";

function dispatchTab(target: HTMLElement) {
  const event = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

describe("playground focus zones demo", () => {
  it("keeps outside Tab native and moves zone plus DOM focus inside the demo", () => {
    render(
      <main>
        <button type="button">Outside playground</button>
        <FocusZonesDemo />
      </main>,
      { wrapper: KeyboardWrapper },
    );

    const outside = screen.getByRole("button", { name: "Outside playground" });
    outside.focus();
    expect(dispatchTab(outside).defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(outside);

    const sidebar = screen.getByRole("button", { name: "sidebar" });
    sidebar.focus();

    expect(dispatchTab(sidebar).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "content" }));
    expect(screen.getByText("content", { selector: ".demo-wrapper__scope" })).toBeTruthy();
  });
});
