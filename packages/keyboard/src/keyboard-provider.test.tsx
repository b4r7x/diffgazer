import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import { useEffect, useRef, type ReactNode } from "react";
import { KeyboardProvider } from "./keyboard-provider";
import { useKeyboardContext } from "./use-keyboard-context";

function Wrapper({ children }: { children: ReactNode }) {
  return <KeyboardProvider>{children}</KeyboardProvider>;
}

function pressKey(key: string, modifiers: Partial<KeyboardEventInit> = {}) {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ...modifiers,
  });
  window.dispatchEvent(event);
}

describe("KeyboardProvider", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("should fire handler when matching key is pressed in active scope", () => {
    const handler = vi.fn();

    function Consumer() {
      const { register } = useKeyboardContext();
      useEffect(() => register("global", "a", handler), []);
      return <div>consumer</div>;
    }

    render(
      <Wrapper>
        <Consumer />
      </Wrapper>,
    );

    act(() => {
      pressKey("a");
    });

    expect(handler).toHaveBeenCalledOnce();
  });

  it("should not fire handler for non-matching key", () => {
    const handler = vi.fn();

    function Consumer() {
      const { register } = useKeyboardContext();
      useEffect(() => register("global", "a", handler), []);
      return <div>consumer</div>;
    }

    render(
      <Wrapper>
        <Consumer />
      </Wrapper>,
    );

    act(() => {
      pressKey("b");
    });

    expect(handler).not.toHaveBeenCalled();
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
            if (event.key === "ArrowRight") {
              event.preventDefault();
            }
          }}
        >
          local
        </button>
      );
    }

    render(
      <Wrapper>
        <Consumer />
      </Wrapper>,
    );

    const button = screen.getByTestId("local-handler");
    button.focus();

    act(() => {
      button.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowRight",
          bubbles: true,
          cancelable: true,
        }),
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

    render(
      <Wrapper>
        <Consumer />
      </Wrapper>,
    );

    act(() => {
      pressKey("a");
    });

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

    render(
      <Wrapper>
        <Consumer />
      </Wrapper>,
    );

    act(() => {
      popRef.current();
    });

    act(() => {
      pressKey("a");
    });

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

    render(
      <Wrapper>
        <Consumer />
      </Wrapper>,
    );

    act(() => {
      pressKey("a");
    });
    expect(handler).toHaveBeenCalledOnce();

    act(() => {
      unregisterRef.current();
    });

    act(() => {
      pressKey("a");
    });
    expect(handler).toHaveBeenCalledOnce(); // still 1
  });

  it("should ignore keyboard events from input elements by default", () => {
    const handler = vi.fn();

    function Consumer() {
      const { register } = useKeyboardContext();
      useEffect(() => register("global", "a", handler), []);
      return <input data-testid="test-input" />;
    }

    render(
      <Wrapper>
        <Consumer />
      </Wrapper>,
    );

    const input = screen.getByTestId("test-input");
    act(() => {
      const event = new KeyboardEvent("keydown", {
        key: "a",
        bubbles: true,
        cancelable: true,
      });
      input.dispatchEvent(event);
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it("should fire handler from input when allowInInput is true", () => {
    const handler = vi.fn();

    function Consumer() {
      const { register } = useKeyboardContext();
      useEffect(() => register("global", "Escape", handler, { allowInInput: true }), []);
      return <input data-testid="test-input-allow" />;
    }

    render(
      <Wrapper>
        <Consumer />
      </Wrapper>,
    );

    const input = screen.getByTestId("test-input-allow");
    act(() => {
      const event = new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      });
      input.dispatchEvent(event);
    });

    expect(handler).toHaveBeenCalledOnce();
  });

  it("should support modifier keys in hotkey matching", () => {
    const handler = vi.fn();

    function Consumer() {
      const { register } = useKeyboardContext();
      useEffect(() => register("global", "ctrl+s", handler), []);
      return <div>consumer</div>;
    }

    render(
      <Wrapper>
        <Consumer />
      </Wrapper>,
    );

    act(() => {
      pressKey("s");
    });
    expect(handler).not.toHaveBeenCalled();

    act(() => {
      pressKey("s", { ctrlKey: true });
    });
    expect(handler).toHaveBeenCalledOnce();
  });

  it("should prioritize the latest handler for the same hotkey in the same scope", () => {
    const firstHandler = vi.fn();
    const secondHandler = vi.fn();

    function Consumer() {
      const { register } = useKeyboardContext();
      useEffect(() => {
        register("global", "a", firstHandler);
        register("global", "a", secondHandler);
      }, []);
      return <div>consumer</div>;
    }

    render(
      <Wrapper>
        <Consumer />
      </Wrapper>
    );

    act(() => {
      pressKey("a");
    });

    expect(secondHandler).toHaveBeenCalledOnce();
    expect(firstHandler).not.toHaveBeenCalled();
  });

  it("should call previous handler after latest one is deregistered", () => {
    const firstHandler = vi.fn();
    const secondHandler = vi.fn();
    const unregisterLatestRef = { current: () => {} };

    function Consumer() {
      const { register } = useKeyboardContext();
      useEffect(() => {
        register("global", "a", firstHandler);
        unregisterLatestRef.current = register("global", "a", secondHandler);
      }, []);
      return <div>consumer</div>;
    }

    render(
      <Wrapper>
        <Consumer />
      </Wrapper>
    );

    act(() => {
      pressKey("a");
    });
    expect(secondHandler).toHaveBeenCalledOnce();
    expect(firstHandler).not.toHaveBeenCalled();

    act(() => {
      unregisterLatestRef.current();
    });

    act(() => {
      pressKey("a");
    });
    expect(firstHandler).toHaveBeenCalledOnce();
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

    render(
      <Wrapper>
        <Consumer />
      </Wrapper>
    );

    const outside = screen.getByTestId("outside");
    const insideButton = screen.getByTestId("inside-button");

    act(() => {
      outside.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowDown",
          bubbles: true,
          cancelable: true,
        })
      );
    });
    expect(handler).not.toHaveBeenCalled();

    act(() => {
      insideButton.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowDown",
          bubbles: true,
          cancelable: true,
        })
      );
    });
    expect(handler).toHaveBeenCalledOnce();
  });
});
