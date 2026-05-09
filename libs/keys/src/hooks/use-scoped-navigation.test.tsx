import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, screen, act } from "@testing-library/react";
import { useRef, type ReactNode } from "react";
import { KeyboardProvider } from "../providers/keyboard-provider";
import { useScopedNavigation, type UseScopedNavigationOptions } from "./use-scoped-navigation";
import { useScope } from "./use-scope";
import { fireKey } from "../testing/test-utils";

function wrapper({ children }: { children: ReactNode }) {
  return <KeyboardProvider>{children}</KeyboardProvider>;
}

function TestList({
  items = ["a", "b", "c"],
  ...options
}: Partial<UseScopedNavigationOptions> & { items?: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const result = useScopedNavigation({
    containerRef: ref,
    role: "option",
    ...options,
  });

  return (
    <div ref={ref} data-testid="list">
      {items.map((item) => (
        <div key={item} role="option" data-value={item} data-testid={`item-${item}`} />
      ))}
      <span data-testid="focused">{result.highlighted ?? ""}</span>
    </div>
  );
}

function getFocused() {
  return screen.getByTestId("focused").textContent;
}

describe("useScopedNavigation", () => {
  afterEach(() => {
    cleanup();
  });

  it("routes navigation through KeyboardProvider: arrows, wrap, Home, End, Space, Enter", () => {
    const onSelect = vi.fn();
    const onEnter = vi.fn();
    render(<TestList initialValue="a" onSelect={onSelect} onEnter={onEnter} />, { wrapper });

    act(() => fireKey("ArrowDown"));
    expect(getFocused()).toBe("b");

    act(() => fireKey("ArrowDown"));
    act(() => fireKey("ArrowDown"));
    expect(getFocused()).toBe("a");

    act(() => fireKey("End"));
    expect(getFocused()).toBe("c");

    act(() => fireKey("Home"));
    expect(getFocused()).toBe("a");

    act(() => fireKey(" "));
    expect(onSelect).toHaveBeenCalledWith("a", expect.any(KeyboardEvent));

    act(() => fireKey("Enter"));
    expect(onEnter).toHaveBeenCalledWith("a", expect.any(KeyboardEvent));
  });

  it("requires KeyboardProvider", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => render(<TestList />)).toThrow("useKeyboardContext must be used within KeyboardProvider");

    consoleError.mockRestore();
  });

  it("does not register Space or Enter activation when moveFocus is true", () => {
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
        <div ref={ref} data-testid="list">
          <button type="button" data-value="a" data-testid="button-a">A</button>
          <button type="button" data-value="b" data-testid="button-b">B</button>
          <span data-testid="focused">{result.highlighted ?? ""}</span>
        </div>
      );
    }

    render(<MoveFocusList />, { wrapper });

    act(() => fireKey("ArrowDown"));
    expect(getFocused()).toBe("b");
    expect(document.activeElement).toBe(screen.getByTestId("button-b"));

    act(() => fireKey(" "));
    act(() => fireKey("Enter"));

    expect(onSelect).not.toHaveBeenCalled();
    expect(onEnter).not.toHaveBeenCalled();
  });

  it("only handles keys when its explicit scope is active", () => {
    function ScopedList({ active }: { active: boolean }) {
      useScope("scoped-list", { enabled: active });
      return <TestList scope="scoped-list" initialValue="a" />;
    }

    const { rerender } = render(<ScopedList active={false} />, { wrapper });

    act(() => fireKey("ArrowDown"));
    expect(getFocused()).toBe("a");

    rerender(<ScopedList active />);

    act(() => fireKey("ArrowDown"));
    expect(getFocused()).toBe("b");
  });

  it("pauses outer scoped navigation while an inner scope is active and resumes after unmount", () => {
    function ScopedHarness({ showInner }: { showInner: boolean }) {
      useScope("outer");
      return (
        <>
          <TestList scope="outer" initialValue="a" items={["a", "b"]} />
          {showInner && <InnerList />}
        </>
      );
    }

    function InnerList() {
      useScope("inner");
      const ref = useRef<HTMLDivElement>(null);
      const result = useScopedNavigation({
        containerRef: ref,
        scope: "inner",
        role: "option",
        initialValue: "x",
      });

      return (
        <div ref={ref}>
          <div role="option" data-value="x" />
          <div role="option" data-value="y" />
          <span data-testid="inner-focused">{result.highlighted ?? ""}</span>
        </div>
      );
    }

    const { rerender } = render(<ScopedHarness showInner />, { wrapper });

    act(() => fireKey("ArrowDown"));
    expect(getFocused()).toBe("a");
    expect(screen.getByTestId("inner-focused").textContent).toBe("y");

    rerender(<ScopedHarness showInner={false} />);

    act(() => fireKey("ArrowDown"));
    expect(getFocused()).toBe("b");
  });
});
