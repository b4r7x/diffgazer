import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactNode, useEffect, useRef } from "react";
import { describe, expect, it, vi } from "vitest";
import UseKeyMap from "../../registry/examples/use-key/use-key-map.js";
import UseScopeBasic from "../../registry/examples/use-scope/use-scope-basic.js";
import { DECLINE } from "../core/normalize-key-input.js";
import { useScope } from "../hooks/use-scope.js";
import { requireFrameDocument } from "../testing/assertions.js";
import { KeyboardWrapper, fireKey as pressKey } from "../testing/test-utils.js";
import { useKeyboardContext, useKeyboardRegistryContext } from "./keyboard-context.js";

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

  it("keeps the Types prevention contract aligned with the KeyboardProvider reference", () => {
    const docsDirectory = resolve(process.cwd(), "docs/content/api");
    const providerPage = readFileSync(resolve(docsDirectory, "keyboard-provider.mdx"), "utf8");
    const typesPage = readFileSync(resolve(docsDirectory, "types.mdx"), "utf8");
    const providerContract = providerPage.match(/^- `preventDefault` contract\. (.+)$/m)?.[1];

    expect(providerContract).toBeDefined();
    expect(typesPage).toContain(providerContract);
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

  it("warns once per registration for an unknown modifier, never per keydown", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const handler = vi.fn();

    function Consumer() {
      const { register } = useKeyboardContext();
      useEffect(() => {
        // string type bypasses ValidateHotkey to reach the runtime registration-time warn.
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
    // count 2 proves a thrown handler didn't wedge the dispatcher
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
    // count 2 proves popping A's same-named scope didn't disturb B's independent scope
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
    // count 2 proves popping manual restored routing to the panel scope
    expect(panelHandler).toHaveBeenCalledTimes(2);
  });

  it("activates the later-mounted scope across sibling branches under client useId encoding", () => {
    // Depth-major comparison of parsed React useId segments. With client sequential
    // ids, a deep scope in the EARLIER sibling yields to a shallow scope in the LATER
    // sibling (larger id segment); the SSR case below resolves the other way (deepest-wins).
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

  it("fires focus-scoped handlers when a composed event originates inside a shadow-root container", () => {
    const handler = vi.fn();
    let innerTarget: HTMLButtonElement | null = null;

    function Consumer() {
      const { register } = useKeyboardContext();
      const containerRef = useRef<HTMLElement | null>(null);
      const hostRef = useRef<HTMLDivElement>(null);
      useEffect(() => {
        const host = hostRef.current;
        if (!host) return;
        const root = host.attachShadow({ mode: "open" });
        const container = document.createElement("div");
        innerTarget = document.createElement("button");
        container.append(innerTarget);
        root.append(container);
        containerRef.current = container;
      }, []);
      useEffect(() => {
        return register("global", "ArrowDown", handler, {
          containerRef,
          focusWithinOnly: true,
        });
      }, [register]);
      return <div ref={hostRef} />;
    }

    renderInProvider(<Consumer />);

    if (!innerTarget) throw new Error("shadow target missing");

    // The browser retargets `event.target` to the shadow host, which lives
    // outside the container; only the composed path reveals the real target
    // inside the container so containment must be judged from it.
    fireKeyFrom(innerTarget, "ArrowDown", { composed: true });
    expect(handler).toHaveBeenCalledOnce();
  });

  it("fires focus-scoped handlers through a nested open shadow root inside the container", () => {
    const handler = vi.fn();
    let innerTarget: HTMLButtonElement | null = null;

    function Consumer() {
      const { register } = useKeyboardContext();
      const containerRef = useRef<HTMLDivElement>(null);
      const hostRef = useRef<HTMLDivElement>(null);
      useEffect(() => {
        const host = hostRef.current;
        if (!host) return;
        const root = host.attachShadow({ mode: "open" });
        innerTarget = document.createElement("button");
        root.append(innerTarget);
      }, []);
      useEffect(() => {
        return register("global", "ArrowDown", handler, {
          containerRef,
          focusWithinOnly: true,
        });
      }, [register]);
      return (
        <div ref={containerRef}>
          <div ref={hostRef} />
        </div>
      );
    }

    renderInProvider(<Consumer />);

    if (!innerTarget) throw new Error("nested shadow target missing");
    fireKeyFrom(innerTarget, "ArrowDown", { composed: true });
    expect(handler).toHaveBeenCalledOnce();
  });

  it("skips handlers for Shadow DOM text inputs unless allowInInput is set", () => {
    const blocked = vi.fn();
    const allowed = vi.fn();
    let shadowInput: HTMLInputElement | null = null;

    function Consumer() {
      const { register } = useKeyboardContext();
      const hostRef = useRef<HTMLDivElement>(null);
      useEffect(() => {
        register("global", "a", blocked);
        register("global", "Escape", allowed, { allowInInput: true });
      }, [register]);
      useEffect(() => {
        const host = hostRef.current;
        if (!host) return;
        const root = host.attachShadow({ mode: "open" });
        shadowInput = document.createElement("input");
        root.append(shadowInput);
      }, []);
      return <div ref={hostRef} />;
    }

    render(
      <KeyboardWrapper>
        <Consumer />
      </KeyboardWrapper>,
    );

    if (!shadowInput) throw new Error("shadow input missing");

    // Composed path reveals the shadow input; event.target is retargeted to the host.
    fireKeyFrom(shadowInput, "a", { composed: true });
    expect(blocked).not.toHaveBeenCalled();

    fireKeyFrom(shadowInput, "Escape", { composed: true });
    expect(allowed).toHaveBeenCalledOnce();
  });

  it("binds to the rendered document's window so iframe key events are handled and parent events ignored", () => {
    const frame = document.createElement("iframe");
    document.body.append(frame);
    const frameDocument = requireFrameDocument(frame);
    const frameWindow = frameDocument.defaultView;
    if (!frameWindow) throw new Error("iframe window missing");

    const container = frameDocument.createElement("div");
    frameDocument.body.append(container);

    const handler = vi.fn();

    function Consumer() {
      const { register } = useKeyboardContext();
      useEffect(() => register("global", "a", handler), [register]);
      return <div>frame consumer</div>;
    }

    render(
      <KeyboardWrapper>
        <Consumer />
      </KeyboardWrapper>,
      { container },
    );

    act(() => {
      frameWindow.dispatchEvent(
        new frameWindow.KeyboardEvent("keydown", { key: "a", bubbles: true, cancelable: true }),
      );
    });
    expect(handler).toHaveBeenCalledOnce();

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "a", bubbles: true, cancelable: true }),
      );
    });
    expect(handler).toHaveBeenCalledOnce();
  });
});
