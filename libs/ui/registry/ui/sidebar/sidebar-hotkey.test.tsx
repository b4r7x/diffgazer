import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "../../../testing/axe";
import { Sidebar } from "./index";

describe("Sidebar Cmd/Ctrl+B hotkey", () => {
  function dispatchShortcut(modifier: { metaKey?: boolean; ctrlKey?: boolean }, shiftKey = false) {
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "b", ...modifier, shiftKey }));
    });
  }

  it.each([
    ["Cmd", { metaKey: true }],
    ["Ctrl", { ctrlKey: true }],
  ] as const)("cycles open ↔ rail on %s+B", (_label, modifier) => {
    const onStateChange = vi.fn();
    render(
      <Sidebar.Provider defaultState="open" onStateChange={onStateChange}>
        <Sidebar>
          <Sidebar.Content>
            <Sidebar.Item as="button">Item</Sidebar.Item>
          </Sidebar.Content>
        </Sidebar>
      </Sidebar.Provider>,
    );

    dispatchShortcut(modifier);
    expect(onStateChange).toHaveBeenLastCalledWith("rail");

    dispatchShortcut(modifier);
    expect(onStateChange).toHaveBeenLastCalledWith("open");
  });

  it.each([
    ["Cmd", { metaKey: true }],
    ["Ctrl", { ctrlKey: true }],
  ] as const)("toggles hidden state on Shift+%s+B", (_label, modifier) => {
    const onStateChange = vi.fn();
    render(
      <Sidebar.Provider defaultState="open" onStateChange={onStateChange}>
        <Sidebar>
          <Sidebar.Content>
            <Sidebar.Item as="button">Item</Sidebar.Item>
          </Sidebar.Content>
        </Sidebar>
      </Sidebar.Provider>,
    );

    dispatchShortcut(modifier, true);
    expect(onStateChange).toHaveBeenLastCalledWith("hidden");
  });

  it("does not bind the hotkey for a provider-less Sidebar", () => {
    render(
      <Sidebar>
        <Sidebar.Content>
          <Sidebar.Item as="button">Item</Sidebar.Item>
        </Sidebar.Content>
      </Sidebar>,
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "b", metaKey: true }));
    });
    expect(screen.getByRole("navigation")).toHaveAttribute("data-state", "open");
  });

  it("does not toggle when focus is in an editable target", () => {
    const onStateChange = vi.fn();
    render(
      <Sidebar.Provider defaultState="open" onStateChange={onStateChange}>
        <Sidebar>
          <Sidebar.Content>
            <Sidebar.Item as="button">Item</Sidebar.Item>
          </Sidebar.Content>
        </Sidebar>
        <input aria-label="search" />
      </Sidebar.Provider>,
    );
    const input = screen.getByLabelText("search");
    input.focus();

    act(() => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "b", metaKey: true, bubbles: true }));
    });
    expect(onStateChange).not.toHaveBeenCalled();
  });

  it("does not toggle when focus is in a select or textarea", () => {
    const onStateChange = vi.fn();
    render(
      <Sidebar.Provider defaultState="open" onStateChange={onStateChange}>
        <Sidebar>
          <Sidebar.Content>
            <Sidebar.Item as="button">Item</Sidebar.Item>
          </Sidebar.Content>
        </Sidebar>
        <select aria-label="filter">
          <option>One</option>
        </select>
        <textarea aria-label="notes" />
      </Sidebar.Provider>,
    );

    for (const label of ["filter", "notes"]) {
      const el = screen.getByLabelText(label);
      el.focus();
      act(() => {
        el.dispatchEvent(new KeyboardEvent("keydown", { key: "b", metaKey: true, bubbles: true }));
      });
    }
    expect(onStateChange).not.toHaveBeenCalled();
  });

  it("does not toggle for an editable target inside an open shadow root", () => {
    const onStateChange = vi.fn();
    render(
      <Sidebar.Provider defaultState="open" onStateChange={onStateChange}>
        <Sidebar>
          <Sidebar.Content>
            <Sidebar.Item as="button">Item</Sidebar.Item>
          </Sidebar.Content>
        </Sidebar>
      </Sidebar.Provider>,
    );

    const host = document.createElement("div");
    document.body.append(host);
    const shadowRoot = host.attachShadow({ mode: "open" });
    const input = document.createElement("input");
    shadowRoot.append(input);
    input.focus();

    // A composed keydown surfaces the host as event.target on the window
    // listener; only composedPath()[0] reveals the editable shadow input.
    act(() => {
      input.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "b",
          metaKey: true,
          bubbles: true,
          composed: true,
        }),
      );
    });

    expect(onStateChange).not.toHaveBeenCalled();
    host.remove();
  });

  it("has no a11y violations", async () => {
    const { container } = render(
      <Sidebar.Provider defaultState="open">
        <Sidebar>
          <Sidebar.Content>
            <Sidebar.Item as="button">Item</Sidebar.Item>
          </Sidebar.Content>
        </Sidebar>
      </Sidebar.Provider>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
