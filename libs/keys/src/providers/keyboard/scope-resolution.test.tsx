import { act, render } from "@testing-library/react";
import { type ReactNode, useEffect } from "react";
// @ts-expect-error -- react-dom/server has no bundled types and @types/react-dom
// is not a devDependency of this workspace; renderToString is used untyped below.
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { useKey } from "../../hooks/use-key.js";
import { useScope } from "../../hooks/use-scope.js";
import { KeyboardWrapper, fireKey as pressKey } from "../../testing/internal/test-utils.js";
import { useKeyboardContext } from "../keyboard-context.js";

describe("KeyboardProvider scope resolution", () => {
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

  it("suppresses unscoped useKey handlers outside an imperative pushScope layer", () => {
    const pageHandler = vi.fn();
    const paletteHandler = vi.fn();
    const pushPaletteRef = { current: () => () => {} };

    function Page() {
      useKey("a", pageHandler);
      const { register, pushScope } = useKeyboardContext();

      useEffect(() => {
        register("palette", "b", paletteHandler);
        pushPaletteRef.current = () => pushScope("palette");
      }, [register, pushScope]);

      return null;
    }

    render(
      <KeyboardWrapper>
        <Page />
      </KeyboardWrapper>,
    );

    act(() => pressKey("a"));
    expect(pageHandler).toHaveBeenCalledOnce();

    let popPalette = () => {};
    act(() => {
      popPalette = pushPaletteRef.current();
    });

    act(() => pressKey("a"));
    expect(pageHandler).toHaveBeenCalledOnce();

    act(() => pressKey("b"));
    expect(paletteHandler).toHaveBeenCalledOnce();

    act(() => popPalette());

    act(() => pressKey("a"));
    expect(pageHandler).toHaveBeenCalledTimes(2);
  });

  it("activates the later-mounted scope across sibling branches under client useId encoding", () => {
    // Depth-major comparison of parsed React useId segments. With client sequential
    // ids, a deep scope in the EARLIER sibling yields to a shallow scope in the LATER
    // sibling (larger id segment); the SSR/hydration case below resolves the other way
    // (deepest-wins) because renderToString packs tree depth into the id itself.
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

  it("activates the correctly-ordered scope across sibling branches after real SSR renderToString/hydrateRoot hydration", () => {
    const deepHandler = vi.fn();
    const shallowHandler = vi.fn();

    function Nest({ children }: { children: ReactNode }) {
      return <div>{children}</div>;
    }

    function DeepScope() {
      useScope("deep");
      useKey("a", deepHandler, { scope: "deep" });
      return <div>deep</div>;
    }

    function ShallowScope() {
      useScope("shallow");
      useKey("a", shallowHandler, { scope: "shallow" });
      return <div>shallow</div>;
    }

    function SiblingDepthTree() {
      return (
        <KeyboardWrapper>
          <Nest>
            <Nest>
              <Nest>
                <DeepScope />
              </Nest>
            </Nest>
          </Nest>
          <ShallowScope />
        </KeyboardWrapper>
      );
    }

    const container = document.createElement("div");
    container.innerHTML = renderToString(<SiblingDepthTree />);
    document.body.append(container);

    const view = render(<SiblingDepthTree />, { container, hydrate: true });

    // React's real renderToString/hydrateRoot useId sequence assigns each scope a
    // plain sequential order, the same ordering the client-mount case above
    // verifies -- now proven to survive a genuine server-rendered id string
    // through hydration instead of the hand-typed literal id it replaces.
    act(() => pressKey("a"));
    expect(shallowHandler).toHaveBeenCalledOnce();
    expect(deepHandler).not.toHaveBeenCalled();

    view.unmount();
    container.remove();
  });

  it("keeps a colocated implicit useKey bound to its own scope when real hydration produces an H-suffixed local id, and resumes once the enclosing scope is removed", () => {
    const handler = vi.fn();

    function ScopeWithColocatedHandler() {
      // Two useId-backed hooks in one component: useScope's own push order is
      // the base id, and useKey's implicit registration order becomes its
      // real React H-suffixed local id (e.g. "_R_0_" then "_R_0H1_").
      useScope("a");
      useKey("a", handler);
      return <div>a</div>;
    }

    function InnerScope() {
      useScope("b");
      return <div>b</div>;
    }

    function ColocatedScopeTree({ includeInner }: { includeInner: boolean }) {
      return (
        <KeyboardWrapper>
          <ScopeWithColocatedHandler />
          {includeInner && <InnerScope />}
        </KeyboardWrapper>
      );
    }

    const container = document.createElement("div");
    container.innerHTML = renderToString(<ColocatedScopeTree includeInner />);
    document.body.append(container);

    const view = render(<ColocatedScopeTree includeInner />, { container, hydrate: true });

    act(() => pressKey("a"));
    expect(handler).not.toHaveBeenCalled();

    view.rerender(<ColocatedScopeTree includeInner={false} />);

    act(() => pressKey("a"));
    expect(handler).toHaveBeenCalledOnce();

    view.unmount();
    container.remove();
  });
});
