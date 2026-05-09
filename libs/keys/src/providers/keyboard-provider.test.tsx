import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useRef, type ReactNode } from "react";
import { KeyboardProvider } from "./keyboard-provider";
import { useKeyboardContext, useKeyboardRegistryContext } from "../context/keyboard-context";
import { useScope } from "../hooks/use-scope";
import { fireKey as pressKey } from "../testing/test-utils";

function Wrapper({ children }: { children: ReactNode }) {
  return <KeyboardProvider>{children}</KeyboardProvider>;
}

describe("KeyboardProvider", () => {
  afterEach(() => cleanup());

  it("should fire handler only for matching key in active scope", async () => {
    const handler = vi.fn();

    function Consumer() {
      const { register } = useKeyboardContext();
      useEffect(() => register("global", "a", handler), []);
      return <div>consumer</div>;
    }

    render(<Wrapper><Consumer /></Wrapper>);

    await userEvent.keyboard("b");
    expect(handler).not.toHaveBeenCalled();

    await userEvent.keyboard("a");
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

  it("should ignore events already handled by local keydown listeners", async () => {
    const handler = vi.fn();

    function Consumer() {
      const { register } = useKeyboardContext();
      useEffect(() => register("global", "ArrowRight", handler), []);
      return (
        <button
          onKeyDown={(event) => {
            if (event.key === "ArrowRight") event.preventDefault();
          }}
        >
          local
        </button>
      );
    }

    render(<Wrapper><Consumer /></Wrapper>);

    const button = screen.getByRole("button", { name: "local" });
    button.focus();
    await userEvent.keyboard("{ArrowRight}");

    expect(handler).not.toHaveBeenCalled();
  });

  it("should only fire handlers in the active scope", async () => {
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

    await userEvent.keyboard("a");
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

  it("should ignore keyboard events from input elements unless allowInInput is true", async () => {
    const blocked = vi.fn();
    const allowed = vi.fn();

    function Consumer() {
      const { register } = useKeyboardContext();
      useEffect(() => {
        register("global", "a", blocked);
        register("global", "Escape", allowed, { allowInInput: true });
      }, []);
      return <input aria-label="Search" />;
    }

    render(<Wrapper><Consumer /></Wrapper>);

    const input = screen.getByRole("textbox", { name: "Search" });
    input.focus();
    await userEvent.keyboard("a");
    expect(blocked).not.toHaveBeenCalled();

    await userEvent.keyboard("{Escape}");
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

  it("should prioritize the latest handler when duplicate scope names share a hotkey", () => {
    const first = vi.fn();
    const second = vi.fn();
    const popSecondRef = { current: () => {} };

    function ConsumerA() {
      const { register, pushScope } = useKeyboardContext();
      useEffect(() => {
        const unregister = register("modal", "Escape", first);
        const popScope = pushScope("modal");
        return () => {
          unregister();
          popScope();
        };
      }, [register, pushScope]);
      return <div>A</div>;
    }

    function ConsumerB() {
      const { register, pushScope } = useKeyboardContext();
      useEffect(() => {
        const unregister = register("modal", "Escape", second);
        const popScope = pushScope("modal");
        popSecondRef.current = () => {
          unregister();
          popScope();
        };
        return popSecondRef.current;
      }, [register, pushScope]);
      return <div>B</div>;
    }

    render(<Wrapper><ConsumerA /><ConsumerB /></Wrapper>);

    act(() => pressKey("Escape"));
    expect(second).toHaveBeenCalledOnce();
    expect(first).not.toHaveBeenCalled();

    act(() => popSecondRef.current());
    act(() => pressKey("Escape"));
    expect(first).toHaveBeenCalledOnce();
  });

  it("should keep imperative pushScope on top of hook scopes until popped", () => {
    const panelHandler = vi.fn();
    const manualHandler = vi.fn();
    const pushManualRef = { current: () => () => {} };

    function Consumer() {
      useScope("panel");
      const { register, pushScope } = useKeyboardContext();

      useEffect(() => {
        const unregisterPanel = register("panel", "a", panelHandler);
        const unregisterManual = register("manual", "a", manualHandler);
        pushManualRef.current = () => pushScope("manual");
        return () => {
          unregisterPanel();
          unregisterManual();
        };
      }, [pushScope, register]);

      return <div>consumer</div>;
    }

    render(<Wrapper><Consumer /></Wrapper>);

    act(() => pressKey("a"));
    expect(panelHandler).toHaveBeenCalledOnce();
    expect(manualHandler).not.toHaveBeenCalled();

    let popManual = () => {};
    act(() => {
      popManual = pushManualRef.current();
    });
    act(() => pressKey("a"));
    expect(manualHandler).toHaveBeenCalledOnce();

    act(() => popManual());
    act(() => pressKey("a"));
    expect(panelHandler).toHaveBeenCalledTimes(2);
  });

  it("should keep registry consumers stable when active scope changes", () => {
    const registryRender = vi.fn();
    const pushScopeRef = { current: (_scope: string) => () => {} };

    function RegistryConsumer() {
      const { pushScope } = useKeyboardRegistryContext();
      registryRender();
      useEffect(() => {
        pushScopeRef.current = pushScope;
      }, [pushScope]);
      return <div>registry</div>;
    }

    render(<Wrapper><RegistryConsumer /></Wrapper>);

    expect(registryRender).toHaveBeenCalledOnce();

    let popScope = () => {};
    act(() => {
      popScope = pushScopeRef.current("modal");
    });
    expect(registryRender).toHaveBeenCalledOnce();

    act(() => popScope());
    expect(registryRender).toHaveBeenCalledOnce();
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

  it("should only trigger focus-scoped handlers when event target is inside containerRef", async () => {
    const handler = vi.fn();

    function Consumer() {
      const { register } = useKeyboardContext();
      const containerRef = useRef<HTMLDivElement>(null);

      useEffect(() => {
        return register("global", "ArrowDown", handler, {
          containerRef,
          focusWithinOnly: true,
        });
      }, [register]);

      return (
        <div>
          <button type="button">Outside</button>
          <div ref={containerRef}>
            <button type="button">Inside</button>
          </div>
        </div>
      );
    }

    render(<Wrapper><Consumer /></Wrapper>);

    const outside = screen.getByRole("button", { name: "Outside" });
    const insideButton = screen.getByRole("button", { name: "Inside" });

    outside.focus();
    await userEvent.keyboard("{ArrowDown}");
    expect(handler).not.toHaveBeenCalled();

    insideButton.focus();
    await userEvent.keyboard("{ArrowDown}");
    expect(handler).toHaveBeenCalledOnce();
  });

});
