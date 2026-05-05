import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, screen, act } from "@testing-library/react";
import { useRef, type ReactNode } from "react";
import { KeyboardProvider } from "../providers/keyboard-provider";
import { useScopedNavigation, type UseScopedNavigationOptions } from "./use-scoped-navigation";
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
});
