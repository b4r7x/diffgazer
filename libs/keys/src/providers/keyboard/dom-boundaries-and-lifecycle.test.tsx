import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { requireFrameDocument } from "../../testing/assertions.js";
import { KeyboardWrapper, fireKey as pressKey } from "../../testing/test-utils.js";
import { useKeyboardContext } from "../keyboard-context.js";

function fireKeyFrom(element: Element, key: string, options?: Partial<KeyboardEventInit>) {
  act(() => {
    element.dispatchEvent(
      new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...options }),
    );
  });
}

describe("KeyboardProvider", () => {
  it("stops receiving key events after the provider unmounts", () => {
    const handler = vi.fn();

    function Consumer() {
      const { register } = useKeyboardContext();
      useEffect(() => {
        // Intentionally not returning register's unregister callback isolates the
        // provider's own listener cleanup: a leaked provider listener would still
        // find this handler registered and invoke it, failing the assertion below.
        register("global", "a", handler);
      }, []);
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

    render(
      <KeyboardWrapper>
        <Consumer />
      </KeyboardWrapper>,
    );

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

    render(
      <KeyboardWrapper>
        <Consumer />
      </KeyboardWrapper>,
    );

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
