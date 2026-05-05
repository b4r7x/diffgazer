import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, screen, act } from "@testing-library/react";
import { useRef, type KeyboardEventHandler } from "react";
import { useNavigation, type UseNavigationOptions } from "./use-navigation";

function onKeyDownProp(fn: (e: globalThis.KeyboardEvent) => void): KeyboardEventHandler {
  return fn as unknown as KeyboardEventHandler;
}

function TestList({
  items = ["a", "b", "c"],
  ...options
}: Partial<UseNavigationOptions> & { items?: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const result = useNavigation({
    containerRef: ref,
    role: "option",
    ...options,
  });

  return (
    <div
      ref={ref}
      data-testid="list"
      onKeyDown={onKeyDownProp(result.onKeyDown)}
    >
      {items.map((item) => (
        <div key={item} role="option" data-value={item} data-testid={`item-${item}`} />
      ))}
      <span data-testid="focused">{result.highlighted ?? ""}</span>
      <span data-testid="is-a">{String(result.isHighlighted("a"))}</span>
      <span data-testid="is-b">{String(result.isHighlighted("b"))}</span>
      <button data-testid="highlight-b" onClick={() => result.highlight("b")} />
    </div>
  );
}

function fireKeyOnElement(container: HTMLElement, key: string) {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
  });
  container.dispatchEvent(event);
}

function getFocused() {
  return screen.getByTestId("focused").textContent;
}

describe("useNavigation", () => {
  afterEach(() => {
    cleanup();
  });

  it("navigates with arrow keys, wraps by default, and calls onBoundaryReached when wrap is false", () => {
    render(<TestList initialValue="a" />);
    const container = screen.getByTestId("list");

    act(() => fireKeyOnElement(container, "ArrowDown"));
    expect(getFocused()).toBe("b");

    act(() => fireKeyOnElement(container, "ArrowDown"));
    expect(getFocused()).toBe("c");

    act(() => fireKeyOnElement(container, "ArrowDown"));
    expect(getFocused()).toBe("a");

    act(() => fireKeyOnElement(container, "ArrowUp"));
    expect(getFocused()).toBe("c");

    // wrap: false — stays at boundary and fires callback
    cleanup();
    const onBoundaryReached = vi.fn();
    render(
      <TestList initialValue="c" wrap={false} onBoundaryReached={onBoundaryReached} />,
    );

    const container2 = screen.getByTestId("list");
    act(() => fireKeyOnElement(container2, "ArrowDown"));
    expect(onBoundaryReached).toHaveBeenCalledWith("down");
    expect(getFocused()).toBe("c");

    act(() => fireKeyOnElement(container2, "ArrowUp"));
    act(() => fireKeyOnElement(container2, "ArrowUp"));
    act(() => fireKeyOnElement(container2, "ArrowUp"));
    expect(onBoundaryReached).toHaveBeenCalledWith("up");
    expect(getFocused()).toBe("a");
  });

  it("Home focuses first, End focuses last", () => {
    render(<TestList initialValue="b" />);
    const container = screen.getByTestId("list");

    act(() => fireKeyOnElement(container, "End"));
    expect(getFocused()).toBe("c");

    act(() => fireKeyOnElement(container, "Home"));
    expect(getFocused()).toBe("a");
  });

  it("Space calls onSelect, Enter calls onEnter or falls back to onSelect", () => {
    const onSelect = vi.fn();
    const onEnter = vi.fn();
    render(<TestList initialValue="b" onSelect={onSelect} onEnter={onEnter} />);
    const container = screen.getByTestId("list");

    act(() => fireKeyOnElement(container, " "));
    expect(onSelect).toHaveBeenCalledWith("b", expect.any(KeyboardEvent));

    act(() => fireKeyOnElement(container, "Enter"));
    expect(onEnter).toHaveBeenCalledWith("b", expect.any(KeyboardEvent));

    onSelect.mockClear();
    onEnter.mockClear();

    cleanup();
    const onSelectOnly = vi.fn();
    render(<TestList initialValue="b" onSelect={onSelectOnly} />);
    const container2 = screen.getByTestId("list");
    act(() => fireKeyOnElement(container2, "Enter"));
    expect(onSelectOnly).toHaveBeenCalledWith("b", expect.any(KeyboardEvent));
  });

  it("enabled: false disables all handlers", () => {
    const onSelect = vi.fn();
    render(
      <TestList initialValue="a" enabled={false} onSelect={onSelect} />,
    );

    const container = screen.getByTestId("list");
    act(() => fireKeyOnElement(container, "ArrowDown"));
    expect(getFocused()).toBe("a");

    act(() => fireKeyOnElement(container, " "));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("custom upKeys/downKeys override defaults", () => {
    render(
      <TestList initialValue="a" upKeys={["ArrowUp", "k"]} downKeys={["ArrowDown", "j"]} />,
    );

    const container = screen.getByTestId("list");
    act(() => fireKeyOnElement(container, "j"));
    expect(getFocused()).toBe("b");

    act(() => fireKeyOnElement(container, "k"));
    expect(getFocused()).toBe("a");
  });

  it("fires onHighlightChange when focus moves", () => {
    const onHighlightChange = vi.fn();
    render(<TestList initialValue="a" onHighlightChange={onHighlightChange} />);

    const container = screen.getByTestId("list");
    act(() => fireKeyOnElement(container, "ArrowDown"));
    expect(onHighlightChange).toHaveBeenCalledWith("b");
  });

  it("controlled mode: value prop sets highlight, onValueChange fires on navigation", () => {
    const onValueChange = vi.fn();
    render(<TestList value="b" onValueChange={onValueChange} />);
    expect(getFocused()).toBe("b");

    const container = screen.getByTestId("list");
    act(() => fireKeyOnElement(container, "ArrowDown"));
    expect(onValueChange).toHaveBeenCalledWith("c");
  });

  it("horizontal orientation uses ArrowRight/ArrowLeft, ignores ArrowUp/ArrowDown", () => {
    render(<TestList initialValue="a" orientation="horizontal" />);
    const container = screen.getByTestId("list");

    act(() => fireKeyOnElement(container, "ArrowRight"));
    expect(getFocused()).toBe("b");

    act(() => fireKeyOnElement(container, "ArrowLeft"));
    expect(getFocused()).toBe("a");

    act(() => fireKeyOnElement(container, "ArrowDown"));
    expect(getFocused()).toBe("a");

    act(() => fireKeyOnElement(container, "ArrowUp"));
    expect(getFocused()).toBe("a");
  });

  describe("skipDisabled", () => {
    it("skips disabled items by default, includes them when skipDisabled is false", () => {
      function DisabledItemList({ skipDisabled }: { skipDisabled?: boolean }) {
        const ref = useRef<HTMLDivElement>(null);
        const result = useNavigation({
          containerRef: ref,
          role: "option",
          initialValue: "a",
          skipDisabled,
        });

        return (
          <div ref={ref} data-testid="list" onKeyDown={onKeyDownProp(result.onKeyDown)}>
            <div role="option" data-value="a" />
            <div role="option" data-value="b" aria-disabled="true" />
            <div role="option" data-value="c" />
            <span data-testid="focused">{result.highlighted ?? ""}</span>
          </div>
        );
      }

      render(<DisabledItemList />);
      const container = screen.getByTestId("list");
      act(() => fireKeyOnElement(container, "ArrowDown"));
      expect(getFocused()).toBe("c");

      cleanup();
      render(<DisabledItemList skipDisabled={false} />);
      const container2 = screen.getByTestId("list");
      act(() => fireKeyOnElement(container2, "ArrowDown"));
      expect(getFocused()).toBe("b");
    });
  });

  describe("moveFocus", () => {
    it("moves DOM focus on arrow/Home/End and suppresses onSelect/onEnter", () => {
      const onSelect = vi.fn();
      const onEnter = vi.fn();

      function MoveFocusList() {
        const ref = useRef<HTMLDivElement>(null);
        const result = useNavigation({
          containerRef: ref,
          role: "button",
          initialValue: "a",
          moveFocus: true,
          onSelect,
          onEnter,
        });

        return (
          <div ref={ref} data-testid="list" onKeyDown={onKeyDownProp(result.onKeyDown)}>
            <button role="button" data-value="a" data-testid="btn-a">A</button>
            <button role="button" data-value="b" data-testid="btn-b">B</button>
            <button role="button" data-value="c" data-testid="btn-c">C</button>
            <span data-testid="focused">{result.highlighted ?? ""}</span>
          </div>
        );
      }

      render(<MoveFocusList />);
      const container = screen.getByTestId("list");

      act(() => fireKeyOnElement(container, "ArrowDown"));
      expect(getFocused()).toBe("b");
      expect(document.activeElement).toBe(screen.getByTestId("btn-b"));

      act(() => fireKeyOnElement(container, "End"));
      expect(getFocused()).toBe("c");

      act(() => fireKeyOnElement(container, "Home"));
      expect(getFocused()).toBe("a");

      // moveFocus suppresses select/enter callbacks
      act(() => fireKeyOnElement(container, " "));
      expect(onSelect).not.toHaveBeenCalled();

      act(() => fireKeyOnElement(container, "Enter"));
      expect(onEnter).not.toHaveBeenCalled();
    });
  });

  it("highlight() and isHighlighted() work together", () => {
    render(<TestList initialValue="a" />);

    expect(screen.getByTestId("is-a").textContent).toBe("true");
    expect(screen.getByTestId("is-b").textContent).toBe("false");

    act(() => screen.getByTestId("highlight-b").click());
    expect(getFocused()).toBe("b");
    expect(screen.getByTestId("is-a").textContent).toBe("false");
    expect(screen.getByTestId("is-b").textContent).toBe("true");
  });
});
