import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useRef, type ReactNode } from "react";
import { useKeyboardContext } from "../context/keyboard-context.js";
import { useScope } from "../hooks/use-scope.js";
import { DECLINE } from "../core/normalize-key-input.js";
import { fireKey as pressKey, KeyboardWrapper } from "../testing/test-utils.js";

function fireKeyFrom(element: Element, key: string) {
  act(() => {
    element.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  });
}

function renderInProvider(children: ReactNode) {
  return render(<KeyboardWrapper>{children}</KeyboardWrapper>);
}

describe("KeyboardProvider", () => {
  afterEach(() => cleanup());

  it("fires handler only for matching key in the active scope", async () => {
    const handler = vi.fn();

    function Consumer() {
      const { register } = useKeyboardContext();
      useEffect(() => register("global", "a", handler), []);
      return <div>consumer</div>;
    }

    render(<KeyboardWrapper><Consumer /></KeyboardWrapper>);

    await userEvent.keyboard("b");
    expect(handler).not.toHaveBeenCalled();

    await userEvent.keyboard("a");
    expect(handler).toHaveBeenCalledOnce();
  });

  it("prevents the default action only when the consumer opts in", () => {
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

    render(<KeyboardWrapper><Consumer /></KeyboardWrapper>);

    const eventA = new KeyboardEvent("keydown", { key: "a", bubbles: true, cancelable: true });
    act(() => window.dispatchEvent(eventA));
    expect(eventA.defaultPrevented).toBe(false);

    const eventB = new KeyboardEvent("keydown", { key: "b", bubbles: true, cancelable: true });
    act(() => window.dispatchEvent(eventB));
    expect(eventB.defaultPrevented).toBe(true);
  });

  it("does not fire when a local keydown listener has already handled the event", async () => {
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

    render(<KeyboardWrapper><Consumer /></KeyboardWrapper>);

    const button = screen.getByRole("button", { name: "local" });
    button.focus();
    await userEvent.keyboard("{ArrowRight}");

    expect(handler).not.toHaveBeenCalled();
  });

  it("fires only handlers registered in the active scope", async () => {
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

    render(<KeyboardWrapper><Consumer /></KeyboardWrapper>);

    await userEvent.keyboard("a");
    expect(modalHandler).toHaveBeenCalledOnce();
    expect(globalHandler).not.toHaveBeenCalled();
  });

  it("resumes routing events to the previous scope after the active scope closes", () => {
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

    render(<KeyboardWrapper><Consumer /></KeyboardWrapper>);

    act(() => popRef.current());
    act(() => pressKey("a"));
    expect(globalHandler).toHaveBeenCalledOnce();
    expect(modalHandler).not.toHaveBeenCalled();
  });

  it("stops firing the handler once the consumer unregisters it", () => {
    const handler = vi.fn();
    const unregisterRef = { current: () => {} };

    function Consumer() {
      const { register } = useKeyboardContext();
      useEffect(() => {
        unregisterRef.current = register("global", "a", handler);
      }, []);
      return <div>consumer</div>;
    }

    render(<KeyboardWrapper><Consumer /></KeyboardWrapper>);

    act(() => pressKey("a"));
    expect(handler).toHaveBeenCalledOnce();

    act(() => unregisterRef.current());
    act(() => pressKey("a"));
    expect(handler).toHaveBeenCalledOnce();
  });

  it("does not fire from text-editable elements unless allowInInput is set", async () => {
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

    render(<KeyboardWrapper><Consumer /></KeyboardWrapper>);

    const input = screen.getByRole("textbox", { name: "Search" });
    input.focus();
    await userEvent.keyboard("a");
    expect(blocked).not.toHaveBeenCalled();

    await userEvent.keyboard("{Escape}");
    expect(allowed).toHaveBeenCalledOnce();
  });

  it.each([
    { controlRole: "checkbox", controlName: "Check", key: "ArrowDown" },
    { controlRole: "radio", controlName: "Pick", key: "ArrowRight" },
    { controlRole: "combobox", controlName: "Select", key: "Escape" },
  ])(
    "fires handler when $key originates from non-text-editable $controlRole control",
    async ({ controlRole, controlName, key }) => {
      const handler = vi.fn();

      function Consumer() {
        const { register } = useKeyboardContext();
        useEffect(() => register("global", key, handler), [register]);

        return (
          <form>
            <label>
              Check
              <input type="checkbox" />
            </label>
            <label>
              Pick
              <input type="radio" name="pick" />
            </label>
            <label>
              Select
              <select>
                <option>A</option>
              </select>
            </label>
          </form>
        );
      }

      renderInProvider(<Consumer />);

      const control = screen.getByRole(controlRole as Parameters<typeof screen.getByRole>[0], { name: controlName });
      control.focus();
      fireKeyFrom(control, key);
      expect(handler).toHaveBeenCalledOnce();
    },
  );

  it.each([
    { description: "DECLINE", latestReturn: DECLINE, earlierCalled: true },
    { description: "undefined", latestReturn: undefined, earlierCalled: false },
  ])(
    "earlier handler $description: latest returns $description, earlier runs=$earlierCalled",
    ({ latestReturn, earlierCalled }) => {
      const earlier = vi.fn();
      const latest = vi.fn(() => latestReturn);

      function Consumer() {
        const { register } = useKeyboardContext();
        useEffect(() => {
          register("global", "a", earlier);
          register("global", "a", latest);
        }, []);
        return <div>consumer</div>;
      }

      renderInProvider(<Consumer />);

      act(() => pressKey("a"));
      expect(latest).toHaveBeenCalledOnce();
      if (earlierCalled) {
        expect(earlier).toHaveBeenCalledOnce();
      } else {
        expect(earlier).not.toHaveBeenCalled();
      }
    },
  );

  it("prefers the latest handler and falls back to the earlier one once it is removed", () => {
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

    render(<KeyboardWrapper><Consumer /></KeyboardWrapper>);

    act(() => pressKey("a"));
    expect(second).toHaveBeenCalledOnce();
    expect(first).not.toHaveBeenCalled();

    act(() => unregisterRef.current());
    act(() => pressKey("a"));
    expect(first).toHaveBeenCalledOnce();
  });

  it("keeps processing subsequent events when a handler throws", () => {
    const errorHandler = vi.fn(() => { throw new Error("handler exploded"); });
    vi.spyOn(console, "error").mockImplementation(() => {});

    function Consumer() {
      const { register } = useKeyboardContext();
      useEffect(() => register("global", "a", errorHandler), []);
      return <div>consumer</div>;
    }

    render(<KeyboardWrapper><Consumer /></KeyboardWrapper>);

    act(() => pressKey("a"));
    expect(errorHandler).toHaveBeenCalledOnce();

    act(() => pressKey("a"));
    // call-count IS the contract: a thrown handler must not leave the dispatcher stuck — the next event still reaches the same handler (count increments to 2)
    expect(errorHandler).toHaveBeenCalledTimes(2);

    vi.restoreAllMocks();
  });

  it("treats identically-named scopes from separate components as independent", () => {
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

    render(<KeyboardWrapper><ConsumerA /><ConsumerB /></KeyboardWrapper>);

    act(() => pressKey("a"));
    expect(handlerA).toHaveBeenCalledOnce();

    act(() => pressKey("b"));
    expect(handlerB).toHaveBeenCalledOnce();

    act(() => popRefA.current());
    act(() => pressKey("b"));
    // call-count IS the contract: popping ConsumerA's same-named scope must NOT affect ConsumerB's independent scope (handlerB still fires, count is 2)
    expect(handlerB).toHaveBeenCalledTimes(2);
  });

  it("prefers the latest handler when identically-named scopes share a hotkey", () => {
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

    render(<KeyboardWrapper><ConsumerA /><ConsumerB /></KeyboardWrapper>);

    act(() => pressKey("Escape"));
    expect(second).toHaveBeenCalledOnce();
    expect(first).not.toHaveBeenCalled();

    act(() => popSecondRef.current());
    act(() => pressKey("Escape"));
    expect(first).toHaveBeenCalledOnce();
  });

  it("routes events to the most-recently-activated scope until it pops back", () => {
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

    render(<KeyboardWrapper><Consumer /></KeyboardWrapper>);

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
    // call-count IS the contract: popping the manual scope must restore routing to the panel scope (panelHandler fires again, count is 2)
    expect(panelHandler).toHaveBeenCalledTimes(2);
  });

  it("stops receiving key events after the provider unmounts", () => {
    const handler = vi.fn();

    function Consumer() {
      const { register } = useKeyboardContext();
      useEffect(() => register("global", "a", handler), []);
      return <div>consumer</div>;
    }

    const { unmount } = render(<KeyboardWrapper><Consumer /></KeyboardWrapper>);

    act(() => pressKey("a"));
    expect(handler).toHaveBeenCalledOnce();

    unmount();

    act(() => pressKey("a"));
    expect(handler).toHaveBeenCalledOnce();
  });

  it("fires focus-scoped handlers only when the event target is inside the focus container", async () => {
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

    render(<KeyboardWrapper><Consumer /></KeyboardWrapper>);

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
