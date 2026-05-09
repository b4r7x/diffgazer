import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KeyboardProvider } from "../providers/keyboard-provider";
import { useScopedNavigation, type UseScopedNavigationOptions } from "./use-scoped-navigation";
import { useScope } from "./use-scope";

function wrapper({ children }: { children: ReactNode }) {
  return <KeyboardProvider>{children}</KeyboardProvider>;
}

function itemId(value: string, prefix = "item") {
  return `${prefix}-${value}`;
}

function TestList({
  items = ["a", "b", "c"],
  label = "Items",
  idPrefix = "item",
  ...options
}: Partial<UseScopedNavigationOptions> & {
  items?: string[];
  label?: string;
  idPrefix?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const result = useScopedNavigation({
    containerRef: ref,
    role: "option",
    ...options,
  });

  return (
    <div
      ref={ref}
      role="listbox"
      aria-label={label}
      aria-activedescendant={result.highlighted === null ? undefined : itemId(result.highlighted, idPrefix)}
      tabIndex={0}
    >
      {items.map((item) => (
        <div
          key={item}
          id={itemId(item, idPrefix)}
          role="option"
          data-value={item}
          aria-selected={result.highlighted === item}
        >
          {item}
        </div>
      ))}
    </div>
  );
}

function activeOption(label = "Items") {
  const listbox = screen.getByRole("listbox", { name: label });
  const id = listbox.getAttribute("aria-activedescendant");
  return id ? document.getElementById(id) : null;
}

function expectActiveOptionText(text: string, label = "Items") {
  expect(activeOption(label)?.textContent).toBe(text);
}

describe("useScopedNavigation", () => {
  afterEach(() => {
    cleanup();
  });

  it("routes navigation and activation through KeyboardProvider", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onEnter = vi.fn();
    render(<TestList initialValue="a" onSelect={onSelect} onEnter={onEnter} />, { wrapper });

    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}{End}{Home} {Enter}");

    expectActiveOptionText("a");
    expect(onSelect).toHaveBeenCalledWith("a", expect.any(KeyboardEvent));
    expect(onEnter).toHaveBeenCalledWith("a", expect.any(KeyboardEvent));
  });

  it("requires KeyboardProvider", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => render(<TestList />)).toThrow("useKeyboardContext must be used within KeyboardProvider");

    consoleError.mockRestore();
  });

  it("moves DOM focus without registering Space or Enter activation when moveFocus is true", async () => {
    const onSelect = vi.fn();
    const onEnter = vi.fn();

    function MoveFocusList() {
      const ref = useRef<HTMLDivElement>(null);
      const result = useScopedNavigation({
        containerRef: ref,
        role: "button",
        initialValue: "a",
        moveFocus: true,
        onSelect,
        onEnter,
      });

      return (
        <div ref={ref} role="group" aria-label="Actions">
          <button type="button" data-value="a">A</button>
          <button type="button" data-value="b">B</button>
        </div>
      );
    }

    render(<MoveFocusList />, { wrapper });

    await userEvent.keyboard("{ArrowDown} {Enter}");

    expect(document.activeElement).toBe(screen.getByRole("button", { name: "B" }));
    expect(onSelect).not.toHaveBeenCalled();
    expect(onEnter).not.toHaveBeenCalled();
  });

  it("only handles keys when its explicit scope is active", async () => {
    const user = userEvent.setup();

    function ScopedList({ active }: { active: boolean }) {
      useScope("scoped-list", { enabled: active });
      return <TestList scope="scoped-list" initialValue="a" />;
    }

    const { rerender } = render(<ScopedList active={false} />, { wrapper });

    await user.keyboard("{ArrowDown}");
    expectActiveOptionText("a");

    rerender(<ScopedList active />);

    await user.keyboard("{ArrowDown}");
    expectActiveOptionText("b");
  });

  it("pauses outer scoped navigation while an inner scope is active and resumes after unmount", async () => {
    const user = userEvent.setup();

    function ScopedHarness({ showInner }: { showInner: boolean }) {
      useScope("outer");
      return (
        <>
          <TestList scope="outer" initialValue="a" items={["a", "b"]} label="Outer items" idPrefix="outer" />
          {showInner && <InnerList />}
        </>
      );
    }

    function InnerList() {
      useScope("inner");
      return <TestList scope="inner" initialValue="x" items={["x", "y"]} label="Inner items" idPrefix="inner" />;
    }

    const { rerender } = render(<ScopedHarness showInner />, { wrapper });

    await user.keyboard("{ArrowDown}");
    expectActiveOptionText("a", "Outer items");
    expectActiveOptionText("y", "Inner items");

    rerender(<ScopedHarness showInner={false} />);

    await user.keyboard("{ArrowDown}");
    expectActiveOptionText("b", "Outer items");
  });
});
