import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import { useEffect, useRef, type ReactNode } from "react";
import { KeyboardProvider } from "./keyboard-provider";
import { useKeyboardContext } from "../context/keyboard-context";
import { fireKey as pressKey } from "../testing/test-utils";

function Wrapper({ children }: { children: ReactNode }) {
  return <KeyboardProvider>{children}</KeyboardProvider>;
}

describe("KeyboardProvider", () => {
  afterEach(() => cleanup());

  it("should fire handler only for matching key in active scope", () => {
    const handler = vi.fn();

    function Consumer() {
      const { register } = useKeyboardContext();
      useEffect(() => register("global", "a", handler), []);
      return <div>consumer</div>;
    }

    render(<Wrapper><Consumer /></Wrapper>);

    act(() => pressKey("b"));
    expect(handler).not.toHaveBeenCalled();

    act(() => pressKey("a"));
    expect(handler).toHaveBeenCalledOnce();
  });

  it("should call preventDefault only when option is explicitly true", () => {
    const defaultHandler = vi.fn();
    const preventHandler = vi.fn();

    function Consumer() {
      const { register } = useKeyboardContext();
      useEffect(() => {
        register("global", "a", defaultHandler);
        register("global", "b", preventHandler, { preventDefault: true });
      }, []);
      return <div>consumer</div>;
    }

    render(<Wrapper><Consumer /></Wrapper>);

    const eventA = new KeyboardEvent("keydown", { key: "a", bubbles: true, cancelable: true });
    const preventSpyA = vi.spyOn(eventA, "preventDefault");
    act(() => window.dispatchEvent(eventA));
    expect(preventSpyA).not.toHaveBeenCalled();

    const eventB = new KeyboardEvent("keydown", { key: "b", bubbles: true, cancelable: true });
    const preventSpyB = vi.spyOn(eventB, "preventDefault");
    act(() => window.dispatchEvent(eventB));
    expect(preventSpyB).toHaveBeenCalledOnce();
  });

  it("should ignore events already handled by local keydown listeners", () => {
    const handler = vi.fn();

    function Consumer() {
      const { register } = useKeyboardContext();
      useEffect(() => register("global", "ArrowRight", handler), []);
      return (
        <button
          data-testid="local-handler"
          onKeyDown={(event) => {
            if (event.key === "ArrowRight") event.preventDefault();
          }}
        >
          local
        </button>
      );
    }

    render(<Wrapper><Consumer /></Wrapper>);

    const button = screen.getByTestId("local-handler");
    button.focus();
    act(() => {
      button.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }),
      );
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it("should only fire handlers in the active scope", () => {
    const globalHandler = vi.fn();
    const modalHandler = vi.fn();

    function Consumer() {
      const { register, pushScope } = useKeyboardContext();
      useEffect(() => {
        register("global", "a", globalHandler);
        register("modal", "a", modalHandler);
        pushScope("modal");
      }, []);
      return <div>consumer</div>;
    }

    render(<Wrapper><Consumer /></Wrapper>);

    act(() => pressKey("a"));
    expect(modalHandler).toHaveBeenCalledOnce();
    expect(globalHandler).not.toHaveBeenCalled();
  });

  it("should restore previous scope when popScope is called", () => {
    const globalHandler = vi.fn();
    const modalHandler = vi.fn();
    const popRef = { current: () => {} };

    function Consumer() {
      const { register, pushScope } = useKeyboardContext();
      useEffect(() => {
        register("global", "a", globalHandler);
        register("modal", "a", modalHandler);
        popRef.current = pushScope("modal");
      }, []);
      return <div>consumer</div>;
    }

    render(<Wrapper><Consumer /></Wrapper>);

    act(() => popRef.current());
    act(() => pressKey("a"));
    expect(globalHandler).toHaveBeenCalledOnce();
    expect(modalHandler).not.toHaveBeenCalled();
  });

  it("should stop firing after handler is deregistered", () => {
    const handler = vi.fn();
    const unregisterRef = { current: () => {} };

    function Consumer() {
      const { register } = useKeyboardContext();
      useEffect(() => {
        unregisterRef.current = register("global", "a", handler);
      }, []);
      return <div>consumer</div>;
    }

    render(<Wrapper><Consumer /></Wrapper>);

    act(() => pressKey("a"));
    expect(handler).toHaveBeenCalledOnce();

    act(() => unregisterRef.current());
    act(() => pressKey("a"));
    expect(handler).toHaveBeenCalledOnce();
  });

  it("should ignore keyboard events from input elements unless allowInInput is true", () => {
    const blocked = vi.fn();
    const allowed = vi.fn();

    function Consumer() {
      const { register } = useKeyboardContext();
      useEffect(() => {
        register("global", "a", blocked);
        register("global", "Escape", allowed, { allowInInput: true });
      }, []);
      return <input data-testid="test-input" />;
    }

    render(<Wrapper><Consumer /></Wrapper>);

    const input = screen.getByTestId("test-input");
    act(() => input.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true, cancelable: true })));
    expect(blocked).not.toHaveBeenCalled();

    act(() => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })));
    expect(allowed).toHaveBeenCalledOnce();
  });

  it("should prioritize latest handler and fall back after deregister", () => {
    const first = vi.fn();
    const second = vi.fn();
    const unregisterRef = { current: () => {} };

    function Consumer() {
      const { register } = useKeyboardContext();
      useEffect(() => {
        register("global", "a", first);
        unregisterRef.current = register("global", "a", second);
      }, []);
      return <div>consumer</div>;
    }

    render(<Wrapper><Consumer /></Wrapper>);

    act(() => pressKey("a"));
    expect(second).toHaveBeenCalledOnce();
    expect(first).not.toHaveBeenCalled();

    act(() => unregisterRef.current());
    act(() => pressKey("a"));
    expect(first).toHaveBeenCalledOnce();
  });

  it("should not crash when a handler throws and should continue processing subsequent events", () => {
    const errorHandler = vi.fn(() => { throw new Error("handler exploded"); });
    vi.spyOn(console, "error").mockImplementation(() => {});

    function Consumer() {
      const { register } = useKeyboardContext();
      useEffect(() => register("global", "a", errorHandler), []);
      return <div>consumer</div>;
    }

    render(<Wrapper><Consumer /></Wrapper>);

    act(() => pressKey("a"));
    expect(errorHandler).toHaveBeenCalledOnce();

    act(() => pressKey("a"));
    expect(errorHandler).toHaveBeenCalledTimes(2);

    vi.restoreAllMocks();
  });

  it("should handle duplicate scope names from separate components independently", () => {
    const handlerA = vi.fn();
    const handlerB = vi.fn();
    const popRefA = { current: () => {} };

    function ConsumerA() {
      const { register, pushScope } = useKeyboardContext();
      useEffect(() => {
        register("modal", "a", handlerA);
        popRefA.current = pushScope("modal");
      }, []);
      return <div>A</div>;
    }

    function ConsumerB() {
      const { register, pushScope } = useKeyboardContext();
      useEffect(() => {
        register("modal", "b", handlerB);
        pushScope("modal");
      }, []);
      return <div>B</div>;
    }

    render(<Wrapper><ConsumerA /><ConsumerB /></Wrapper>);

    act(() => pressKey("a"));
    expect(handlerA).toHaveBeenCalledOnce();

    act(() => pressKey("b"));
    expect(handlerB).toHaveBeenCalledOnce();

    act(() => popRefA.current());
    act(() => pressKey("b"));
    expect(handlerB).toHaveBeenCalledTimes(2);
  });

  it("should stop receiving key events after the provider unmounts", () => {
    const handler = vi.fn();

    function Consumer() {
      const { register } = useKeyboardContext();
      useEffect(() => register("global", "a", handler), []);
      return <div>consumer</div>;
    }

    const { unmount } = render(<Wrapper><Consumer /></Wrapper>);

    act(() => pressKey("a"));
    expect(handler).toHaveBeenCalledOnce();

    unmount();

    act(() => pressKey("a"));
    expect(handler).toHaveBeenCalledOnce();
  });

  it("should only trigger focus-scoped handlers when event target is inside targetRef", () => {
    const handler = vi.fn();

    function Consumer() {
      const { register } = useKeyboardContext();
      const targetRef = useRef<HTMLDivElement>(null);

      useEffect(() => {
        return register("global", "ArrowDown", handler, {
          targetRef,
          requireFocusWithin: true,
        });
      }, [register]);

      return (
        <div>
          <div data-testid="outside" />
          <div ref={targetRef} data-testid="inside-container">
            <button data-testid="inside-button" />
          </div>
        </div>
      );
    }

    render(<Wrapper><Consumer /></Wrapper>);

    const outside = screen.getByTestId("outside");
    const insideButton = screen.getByTestId("inside-button");

    act(() => {
      outside.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
    });
    expect(handler).not.toHaveBeenCalled();

    act(() => {
      insideButton.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
    });
    expect(handler).toHaveBeenCalledOnce();
  });
});
