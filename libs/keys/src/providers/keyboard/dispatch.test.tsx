import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactNode, useEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import UseKeyMap from "../../../registry/examples/use-key/use-key-map.js";
import UseScopeBasic from "../../../registry/examples/use-scope/use-scope-basic.js";
import { DECLINE } from "../../core/normalize-key-input.js";
import { KeyboardWrapper, fireKey as pressKey } from "../../testing/internal/test-utils.js";
import { useKeyboardContext } from "../keyboard-context.js";

function fireKeyFrom(element: Element, key: string, options?: Partial<KeyboardEventInit>) {
  act(() => {
    element.dispatchEvent(
      new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...options }),
    );
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

  it("prevents native Ctrl+U and Ctrl+K accelerators when the demos handle them", () => {
    const mapDemo = render(<UseKeyMap />);
    const underlineEvent = new KeyboardEvent("keydown", {
      key: "u",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });

    act(() => window.dispatchEvent(underlineEvent));

    expect(screen.getByText("Active: underline")).toBeTruthy();
    expect(underlineEvent.defaultPrevented).toBe(true);
    mapDemo.unmount();

    render(<UseScopeBasic />);
    const commandEvent = new KeyboardEvent("keydown", {
      key: "k",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });

    act(() => window.dispatchEvent(commandEvent));

    expect(screen.getByRole("dialog", { name: "Modal" })).toBeTruthy();
    expect(commandEvent.defaultPrevented).toBe(true);
  });

  it("prevents the default after an accepted handler returns but not after a handler declines", () => {
    let acceptedDuringHandler: boolean | undefined;
    let declinedDuringHandler: boolean | undefined;
    const acceptedHandler = vi.fn((event: KeyboardEvent) => {
      acceptedDuringHandler = event.defaultPrevented;
    });
    const declineHandler = vi.fn((event: KeyboardEvent) => {
      declinedDuringHandler = event.defaultPrevented;
      return DECLINE;
    });

    function Consumer() {
      const { register } = useKeyboardContext();
      useEffect(() => {
        register("global", "d", declineHandler, { preventDefault: true });
        register("global", "e", acceptedHandler, { preventDefault: true });
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
    expect(declinedDuringHandler).toBe(false);
    expect(declinedEvent.defaultPrevented).toBe(false);

    const handledEvent = new KeyboardEvent("keydown", {
      key: "e",
      bubbles: true,
      cancelable: true,
    });
    act(() => window.dispatchEvent(handledEvent));
    expect(acceptedHandler).toHaveBeenCalledOnce();
    expect(acceptedDuringHandler).toBe(false);
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
    const toggle = vi.fn();

    function Consumer() {
      const { register } = useKeyboardContext();
      useEffect(() => {
        register("global", "a", blocked);
        register("global", "Escape", allowed, { allowInInput: true });
        register("global", "mod+k", toggle, { allowInInput: true });
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

    fireKeyFrom(input, "k", { ctrlKey: true });
    expect(toggle).toHaveBeenCalledOnce();
  });

  it("preserves editable ownership during IME composition", () => {
    const move = vi.fn();
    const close = vi.fn();

    function Consumer() {
      const { register } = useKeyboardContext();
      useEffect(() => {
        register("global", "ArrowDown", move, { allowInInput: true, preventDefault: true });
        register("global", "Escape", close, { allowInInput: true, preventDefault: true });
      }, [register]);
      return <input aria-label="Search" />;
    }

    renderInProvider(<Consumer />);

    const input = screen.getByRole("textbox", { name: "Search" });
    input.focus();
    const composingArrow = new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
      isComposing: true,
    });
    act(() => input.dispatchEvent(composingArrow));

    const legacyImeEscape = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(legacyImeEscape, "keyCode", { value: 229 });
    act(() => input.dispatchEvent(legacyImeEscape));

    expect(move).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(input);
    expect(composingArrow.defaultPrevented).toBe(false);
    expect(legacyImeEscape.defaultPrevented).toBe(false);

    const postCompositionArrow = new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    });
    act(() => input.dispatchEvent(postCompositionArrow));

    expect(move).toHaveBeenCalledOnce();
    expect(postCompositionArrow.defaultPrevented).toBe(true);
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

  it("never fires a handler registered with an unknown modifier", () => {
    const handler = vi.fn();

    function Consumer() {
      const { register } = useKeyboardContext();
      useEffect(() => {
        // string type bypasses ValidateHotkey to reach the runtime reject path.
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

    act(() => pressKey("a"));
    act(() => pressKey("a"));

    expect(handler).not.toHaveBeenCalled();
  });

  it.each([
    { label: "typo registered first", typoFirst: true },
    { label: "typo registered second", typoFirst: false },
  ])("keeps a typo'd modifier from colliding with a legitimate hotkey ($label)", ({
    typoFirst,
  }) => {
    const legit = vi.fn();
    const typo = vi.fn();

    function Consumer() {
      const { register } = useKeyboardContext();
      useEffect(() => {
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
    // count 2 proves a thrown handler didn't wedge the dispatcher
    expect(errorHandler).toHaveBeenCalledTimes(2);
  });
});
