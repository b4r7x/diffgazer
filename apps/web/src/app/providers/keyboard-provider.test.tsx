import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import { useEffect, type ReactNode } from "react";
import { KeyboardProvider } from "./keyboard-provider";
import { useKeyboardContext } from "@/hooks/keyboard/use-keyboard-context";

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
});
