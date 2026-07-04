import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactNode, useEffect, useRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { DECLINE } from "../core/normalize-key-input.js";
import { useScope } from "../hooks/use-scope.js";
import { KeyboardWrapper, fireKey as pressKey } from "../testing/test-utils.js";
import { useKeyboardContext, useKeyboardRegistryContext } from "./keyboard-context.js";

function fireKeyFrom(element: Element, key: string) {
  act(() => {
    element.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  });
}

function renderInProvider(children: ReactNode) {
  return render(<KeyboardWrapper>{children}</KeyboardWrapper>);
}

describe("KeyboardProvider", () => {
  it("fires handler only for matching key in the active scope", async () => {
    const user = userEvent.setup();
    const handler = vi.fn();

    function Consumer() {
      const { register } = useKeyboardContext();
      useEffect(() => register("global", "a", handler), []);
      return <div>consumer</div>;
    }

    render(
      <KeyboardWrapper>
        <Consumer />
      </KeyboardWrapper>,
    );

    await user.keyboard("b");
    expect(handler).not.toHaveBeenCalled();

    await user.keyboard("a");
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

    render(
      <KeyboardWrapper>
        <Consumer />
      </KeyboardWrapper>,
    );

    const eventA = new KeyboardEvent("keydown", { key: "a", bubbles: true, cancelable: true });
    act(() => window.dispatchEvent(eventA));
    expect(eventA.defaultPrevented).toBe(false);

    const eventB = new KeyboardEvent("keydown", { key: "b", bubbles: true, cancelable: true });
    act(() => window.dispatchEvent(eventB));
    expect(eventB.defaultPrevented).toBe(true);
  });

  it("does not suppress the native default when a preventDefault handler declines", () => {
    const declineHandler = vi.fn(() => DECLINE);
    const handledHandler = vi.fn();

    function Consumer() {
      const { register } = useKeyboardContext();
      useEffect(() => {
        register("global", "d", declineHandler, { preventDefault: true });
        register("global", "e", handledHandler, { preventDefault: true });
      }, [register]);
      return <div>consumer</div>;
    }

    renderInProvider(<Consumer />);

    const declinedEvent = new KeyboardEvent("keydown", {
      key: "d",
      bubbles: true,
      cancelable: true,
    });
    act(() => window.dispatchEvent(declinedEvent));
    expect(declineHandler).toHaveBeenCalledOnce();
    expect(declinedEvent.defaultPrevented).toBe(false);

    const handledEvent = new KeyboardEvent("keydown", {
      key: "e",
      bubbles: true,
      cancelable: true,
    });
    act(() => window.dispatchEvent(handledEvent));
    expect(handledHandler).toHaveBeenCalledOnce();
    expect(handledEvent.defaultPrevented).toBe(true);
  });

  it("does not fire when a local keydown listener has already handled the event", async () => {
    const user = userEvent.setup();
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

    render(
      <KeyboardWrapper>
        <Consumer />
      </KeyboardWrapper>,
    );

    const button = screen.getByRole("button", { name: "local" });
    button.focus();
    await user.keyboard("{ArrowRight}");

    expect(handler).not.toHaveBeenCalled();
  });

  it("fires only handlers registered in the active scope", async () => {
    const user = userEvent.setup();
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
      <KeyboardWrapper>
        <Consumer />
      </KeyboardWrapper>,
    );

    await user.keyboard("a");
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

    render(
      <KeyboardWrapper>
        <Consumer />
      </KeyboardWrapper>,
    );

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

    render(
      <KeyboardWrapper>
        <Consumer />
      </KeyboardWrapper>,
    );

    act(() => pressKey("a"));
    expect(handler).toHaveBeenCalledOnce();

    act(() => unregisterRef.current());
    act(() => pressKey("a"));
    expect(handler).toHaveBeenCalledOnce();
  });

  it("does not fire from text-editable elements unless allowInInput is set", async () => {
    const user = userEvent.setup();
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

    render(
      <KeyboardWrapper>
        <Consumer />
      </KeyboardWrapper>,
    );

    const input = screen.getByRole("textbox", { name: "Search" });
    input.focus();
    await user.keyboard("a");
    expect(blocked).not.toHaveBeenCalled();

    await user.keyboard("{Escape}");
    expect(allowed).toHaveBeenCalledOnce();
  });

  it.each([
    { controlRole: "checkbox", controlName: "Check", key: "ArrowDown" },
    { controlRole: "radio", controlName: "Pick", key: "ArrowRight" },
    { controlRole: "combobox", controlName: "Select", key: "Escape" },
  ])("fires handler when $key originates from non-text-editable $controlRole control", async ({
    controlRole,
    controlName,
    key,
  }) => {
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

    const control = screen.getByRole(controlRole as Parameters<typeof screen.getByRole>[0], {
      name: controlName,
    });
    control.focus();
    fireKeyFrom(control, key);
    expect(handler).toHaveBeenCalledOnce();
  });

  it.each([
    { description: "DECLINE", latestReturn: DECLINE, earlierCalled: true },
    { description: "undefined", latestReturn: undefined, earlierCalled: false },
  ])("earlier handler $description: latest returns $description, earlier runs=$earlierCalled", ({
    latestReturn,
    earlierCalled,
  }) => {
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
  });

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

    render(
      <KeyboardWrapper>
        <Consumer />
      </KeyboardWrapper>,
    );

    act(() => pressKey("a"));
    expect(second).toHaveBeenCalledOnce();
    expect(first).not.toHaveBeenCalled();

    act(() => unregisterRef.current());
    act(() => pressKey("a"));
    expect(first).toHaveBeenCalledOnce();
  });

  it("warns once per registration for an unknown modifier, never per keydown", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const handler = vi.fn();

    function Consumer() {
      const { register } = useKeyboardContext();
      useEffect(() => {
        // Unknown modifiers are rejected by ValidateHotkey, so the dynamic
        // escape hatch reaches the runtime registration-time warn.
        const hotkey: string = "Hyper+a";
        return register("global", hotkey, handler);
      }, []);
      return <div>consumer</div>;
    }

    render(
      <KeyboardWrapper>
        <Consumer />
      </KeyboardWrapper>,
    );

    expect(warn).toHaveBeenCalledTimes(1);

    act(() => pressKey("a"));
    act(() => pressKey("a"));
    act(() => pressKey("a"));

    // The warn fired only at registration; dispatch never re-parses the string.
    expect(warn).toHaveBeenCalledTimes(1);
    expect(handler).not.toHaveBeenCalled();

    warn.mockRestore();
  });

  it.each([
    { label: "typo registered first", typoFirst: true },
    { label: "typo registered second", typoFirst: false },
  ])("keeps a typo'd modifier from colliding with a legitimate hotkey ($label)", ({
    typoFirst,
  }) => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const legit = vi.fn();
    const typo = vi.fn();

    function Consumer() {
      const { register } = useKeyboardContext();
      useEffect(() => {
        // The unknown-modifier segment must keep the typo'd hotkey on a
        // distinct canonical key so it cannot share the "a" entry list.
        const typoHotkey: string = "Hyper+a";
        if (typoFirst) {
          const unregisterTypo = register("global", typoHotkey, typo);
          const unregisterLegit = register("global", "a", legit);
          return () => {
            unregisterTypo();
            unregisterLegit();
          };
        }
        const unregisterLegit = register("global", "a", legit);
        const unregisterTypo = register("global", typoHotkey, typo);
        return () => {
          unregisterLegit();
          unregisterTypo();
        };
      }, []);
      return <div>consumer</div>;
    }

    renderInProvider(<Consumer />);

    act(() => pressKey("a"));
    expect(legit).toHaveBeenCalledOnce();
    expect(typo).not.toHaveBeenCalled();

    vi.restoreAllMocks();
  });

  it("keeps processing subsequent events when a handler throws", () => {
    const errorHandler = vi.fn(() => {
      throw new Error("handler exploded");
    });
    vi.spyOn(console, "error").mockImplementation(() => {});

    function Consumer() {
      const { register } = useKeyboardContext();
      useEffect(() => register("global", "a", errorHandler), []);
      return <div>consumer</div>;
    }

    render(
      <KeyboardWrapper>
        <Consumer />
      </KeyboardWrapper>,
    );

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

    render(
      <KeyboardWrapper>
        <ConsumerA />
        <ConsumerB />
      </KeyboardWrapper>,
    );

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

    render(
      <KeyboardWrapper>
        <ConsumerA />
        <ConsumerB />
      </KeyboardWrapper>,
    );

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

    render(
      <KeyboardWrapper>
        <Consumer />
      </KeyboardWrapper>,
    );

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

  it("activates the later-mounted scope across sibling branches under client useId encoding", () => {
    // Precedence is a depth-major comparison of parsed React `useId` segments.
    // Under the sequential ids React generates on the client, a scope deep
    // inside the EARLIER sibling yields to a shallow scope in the LATER sibling
    // (the later sibling's id segment is larger). The SSR-id case below shows
    // the same comparison resolving the other way (deepest-wins).
    const deepHandler = vi.fn();
    const shallowHandler = vi.fn();

    function DeepScope() {
      useScope("deep");
      const { register } = useKeyboardContext();
      useEffect(() => register("deep", "a", deepHandler), [register]);
      return <div>deep</div>;
    }

    function Nest({ children }: { children: ReactNode }) {
      return <div>{children}</div>;
    }

    function EarlierBranch() {
      return (
        <Nest>
          <Nest>
            <Nest>
              <DeepScope />
            </Nest>
          </Nest>
        </Nest>
      );
    }

    function LaterBranch() {
      useScope("shallow");
      const { register } = useKeyboardContext();
      useEffect(() => register("shallow", "a", shallowHandler), [register]);
      return <div>shallow</div>;
    }

    render(
      <KeyboardWrapper>
        <EarlierBranch />
        <LaterBranch />
      </KeyboardWrapper>,
    );

    act(() => pressKey("a"));
    expect(shallowHandler).toHaveBeenCalledOnce();
    expect(deepHandler).not.toHaveBeenCalled();
  });

  it("activates the deepest scope when SSR/hydration bit-packs nesting depth into the useId", () => {
    // Under SSR the tree position is bit-packed into a single base-32 id, so a
    // deeply nested scope in an EARLIER branch produces a larger order segment
    // than a shallow scope in a LATER branch. These two ids are what React
    // 19.2.4 emits server-side for that shape (deep "_R_t_" -> segments [27,29],
    // shallow "_R_2_" -> [27,2]); the depth-major comparison makes "deep" active.
    const deepHandler = vi.fn();
    const shallowHandler = vi.fn();

    function SsrScopes() {
      const { pushScope, register } = useKeyboardRegistryContext();
      useEffect(() => {
        const popDeep = pushScope("deep", "_R_t_");
        const popShallow = pushScope("shallow", "_R_2_");
        const unregisterDeep = register("deep", "a", deepHandler);
        const unregisterShallow = register("shallow", "a", shallowHandler);
        return () => {
          unregisterDeep();
          unregisterShallow();
          popDeep();
          popShallow();
        };
      }, [pushScope, register]);
      return <div>ssr scopes</div>;
    }

    render(
      <KeyboardWrapper>
        <SsrScopes />
      </KeyboardWrapper>,
    );

    act(() => pressKey("a"));
    expect(deepHandler).toHaveBeenCalledOnce();
    expect(shallowHandler).not.toHaveBeenCalled();
  });

  it("keeps a colocated implicit useKey bound to its own scope when hydrated useIds carry H-suffixed local ids", () => {
    const handler = vi.fn();
    const popBRef = { current: null as null | (() => void) };

    function SsrLocalIdScope() {
      const { pushScope, registerImplicit } = useKeyboardRegistryContext();
      useEffect(() => {
        const popA = pushScope("a", "_R_1_");
        const popB = pushScope("b", "_R_2_");
        popBRef.current = popB;
        const unregister = registerImplicit("_R_1H1_", "a", handler);
        return () => {
          unregister();
          popB();
          popA();
        };
      }, [pushScope, registerImplicit]);
      return <div>ssr local id scope</div>;
    }

    renderInProvider(<SsrLocalIdScope />);

    act(() => pressKey("a"));
    expect(handler).not.toHaveBeenCalled();

    act(() => popBRef.current?.());
    act(() => pressKey("a"));
    expect(handler).toHaveBeenCalledOnce();
  });

  it("stops receiving key events after the provider unmounts", () => {
    const handler = vi.fn();

    function Consumer() {
      const { register } = useKeyboardContext();
      useEffect(() => register("global", "a", handler), []);
      return <div>consumer</div>;
    }

    const { unmount } = render(
      <KeyboardWrapper>
        <Consumer />
      </KeyboardWrapper>,
    );

    act(() => pressKey("a"));
    expect(handler).toHaveBeenCalledOnce();

    unmount();

    act(() => pressKey("a"));
    expect(handler).toHaveBeenCalledOnce();
  });

  it("fires focus-scoped handlers only when the event target is inside the focus container", async () => {
    const user = userEvent.setup();
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

    render(
      <KeyboardWrapper>
        <Consumer />
      </KeyboardWrapper>,
    );

    const outside = screen.getByRole("button", { name: "Outside" });
    const insideButton = screen.getByRole("button", { name: "Inside" });

    outside.focus();
    await user.keyboard("{ArrowDown}");
    expect(handler).not.toHaveBeenCalled();

    insideButton.focus();
    await user.keyboard("{ArrowDown}");
    expect(handler).toHaveBeenCalledOnce();
  });
});
