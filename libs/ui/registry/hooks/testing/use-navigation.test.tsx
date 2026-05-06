import { render, screen, act, cleanup } from "@testing-library/react";
import { useRef, type KeyboardEventHandler } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { useNavigation } from "../use-navigation";

function onKeyDownProp(fn: (event: globalThis.KeyboardEvent) => void): KeyboardEventHandler {
  return fn as unknown as KeyboardEventHandler;
}

function fireKeyOnElement(container: HTMLElement, key: string) {
  container.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
}

describe("useNavigation", () => {
  afterEach(() => {
    cleanup();
  });

  it("navigates data-marked items without role attributes", () => {
    function DataMarkedList() {
      const ref = useRef<HTMLDivElement>(null);
      const result = useNavigation({
        containerRef: ref,
        role: "option",
        initialValue: "a",
      });

      return (
        <div ref={ref} data-testid="list" onKeyDown={onKeyDownProp(result.onKeyDown)}>
          <div data-diffgazer-navigation-item="option" data-value="a" />
          <div data-diffgazer-navigation-item="option" data-value="b" />
          <div data-diffgazer-navigation-item="option" data-value="c" />
          <span data-testid="focused">{result.highlighted ?? ""}</span>
        </div>
      );
    }

    render(<DataMarkedList />);

    act(() => fireKeyOnElement(screen.getByTestId("list"), "ArrowDown"));
    expect(screen.getByTestId("focused")).toHaveTextContent("b");
  });

  it("falls back to data-value items when copied components omit role attributes", () => {
    function DataValueList() {
      const ref = useRef<HTMLDivElement>(null);
      const result = useNavigation({
        containerRef: ref,
        role: "button",
        initialValue: "a",
      });

      return (
        <div ref={ref} data-testid="list" onKeyDown={onKeyDownProp(result.onKeyDown)}>
          <button data-value="a" type="button">A</button>
          <button data-value="b" type="button">B</button>
          <button data-value="c" type="button">C</button>
          <span data-testid="focused">{result.highlighted ?? ""}</span>
        </div>
      );
    }

    render(<DataValueList />);

    act(() => fireKeyOnElement(screen.getByTestId("list"), "ArrowDown"));
    expect(screen.getByTestId("focused")).toHaveTextContent("b");
  });

  it("starts forward navigation on the first enabled item when nothing is highlighted", () => {
    function DataMarkedList() {
      const ref = useRef<HTMLDivElement>(null);
      const result = useNavigation({
        containerRef: ref,
        role: "option",
      });

      return (
        <div ref={ref} data-testid="list" onKeyDown={onKeyDownProp(result.onKeyDown)}>
          <div data-diffgazer-navigation-item="option" data-value="a" />
          <div data-diffgazer-navigation-item="option" data-value="b" />
          <span data-testid="focused">{result.highlighted ?? ""}</span>
        </div>
      );
    }

    render(<DataMarkedList />);

    act(() => fireKeyOnElement(screen.getByTestId("list"), "ArrowDown"));
    expect(screen.getByTestId("focused")).toHaveTextContent("a");
  });

  it("continues navigation from the currently focused DOM item", () => {
    function FocusedList() {
      const ref = useRef<HTMLDivElement>(null);
      const result = useNavigation({
        containerRef: ref,
        role: "button",
        moveFocus: true,
      });

      return (
        <div ref={ref} data-testid="list" onKeyDown={onKeyDownProp(result.onKeyDown)}>
          <button data-value="a" type="button">A</button>
          <button data-value="b" type="button">B</button>
          <button data-value="c" type="button">C</button>
          <span data-testid="focused">{result.highlighted ?? ""}</span>
        </div>
      );
    }

    render(<FocusedList />);
    screen.getByRole("button", { name: "B" }).focus();

    act(() => fireKeyOnElement(screen.getByTestId("list"), "ArrowDown"));
    expect(screen.getByRole("button", { name: "C" })).toHaveFocus();
    expect(screen.getByTestId("focused")).toHaveTextContent("c");
  });
});
