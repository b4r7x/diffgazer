import { describe, it, expect, vi, afterEach } from "vitest";
import { render, renderHook, cleanup, act } from "@testing-library/react";
import { StrictMode, useEffect, useState, type ReactNode } from "react";
import { KeyboardProvider } from "../providers/keyboard-provider";
import { useKeyboardContext } from "../context/keyboard-context";
import { useKey } from "./use-key";
import { useScope } from "./use-scope";
import { fireKey as pressKey } from "../testing/test-utils";

function Wrapper({ children }: { children: ReactNode }) {
  return <KeyboardProvider>{children}</KeyboardProvider>;
}

describe("useScope", () => {
  afterEach(() => {
    cleanup();
  });

  it("scope push/pop lifecycle: active scope receives events, previous scope resumes on unmount", () => {
    const globalHandler = vi.fn();
    const modalHandler = vi.fn();

    function GlobalConsumer() {
      const { register } = useKeyboardContext();
      useEffect(() => register("global", "Escape", globalHandler), []);
      return null;
    }

    function ModalConsumer() {
      const { register } = useKeyboardContext();
      useScope("modal");
      useEffect(() => register("modal", "Escape", modalHandler), []);
      return null;
    }

    const { rerender } = render(
      <Wrapper>
        <GlobalConsumer />
        <ModalConsumer />
      </Wrapper>,
    );

    // While modal scope is active, only modal handlers fire
    act(() => pressKey("Escape"));
    expect(modalHandler).toHaveBeenCalledOnce();
    expect(globalHandler).not.toHaveBeenCalled();

    // Unmount the modal consumer — useScope cleanup pops "modal"
    rerender(
      <Wrapper>
        <GlobalConsumer />
      </Wrapper>,
    );

    // After pop, global scope is active again
    act(() => pressKey("Escape"));
    expect(globalHandler).toHaveBeenCalledOnce();
  });

  it("does not push scope when enabled is false", () => {
    const globalHandler = vi.fn();
    const modalHandler = vi.fn();

    function Consumer() {
      const { register } = useKeyboardContext();
      useScope("modal", { enabled: false });
      useEffect(() => {
        const c1 = register("global", "Escape", globalHandler);
        const c2 = register("modal", "Escape", modalHandler);
        return () => { c1(); c2(); };
      }, []);
      return <div>consumer</div>;
    }

    render(
      <Wrapper>
        <Consumer />
      </Wrapper>,
    );

    act(() => pressKey("Escape"));
    // Scope was not pushed, so active scope is still "global"
    expect(globalHandler).toHaveBeenCalledOnce();
    expect(modalHandler).not.toHaveBeenCalled();
  });

  it("keeps the last sibling scope active when many scopes mount together", () => {
    const handlers = Array.from({ length: 40 }, () => vi.fn());

    function ScopedConsumer({ index }: { index: number }) {
      const scope = `scope-${index}`;
      useScope(scope);
      useKey("Escape", handlers[index]!, { scope });
      return null;
    }

    render(
      <Wrapper>
        {handlers.map((_, index) => (
          <ScopedConsumer key={index} index={index} />
        ))}
      </Wrapper>,
    );

    act(() => pressKey("Escape"));

    expect(handlers.at(-1)).toHaveBeenCalledOnce();
    for (const handler of handlers.slice(0, -1)) {
      expect(handler).not.toHaveBeenCalled();
    }
  });

  it("keeps a nested child scope active over its parent scope", () => {
    const parentHandler = vi.fn();
    const childHandler = vi.fn();

    function ChildScope() {
      const scope = useScope("child");
      useKey("Escape", childHandler, { scope });
      return null;
    }

    function ParentScope() {
      const scope = useScope("parent");
      useKey("Escape", parentHandler, { scope });
      return <ChildScope />;
    }

    render(
      <Wrapper>
        <ParentScope />
      </Wrapper>,
    );

    act(() => pressKey("Escape"));

    expect(childHandler).toHaveBeenCalledOnce();
    expect(parentHandler).not.toHaveBeenCalled();
  });

  it("throws when used outside KeyboardProvider", () => {
    expect(() => {
      renderHook(() => useScope("modal"));
    }).toThrow("useKeyboardContext must be used within KeyboardProvider");
  });

  it("returns the resolved scope name when enabled and null when disabled", () => {
    const seen: Array<string | null> = [];

    function Consumer({ enabled }: { enabled: boolean }) {
      const scope = useScope("modal", { enabled });
      seen.push(scope);
      return null;
    }

    const { rerender } = render(
      <Wrapper>
        <Consumer enabled={false} />
      </Wrapper>,
    );
    expect(seen[seen.length - 1]).toBeNull();

    rerender(
      <Wrapper>
        <Consumer enabled={true} />
      </Wrapper>,
    );
    expect(seen[seen.length - 1]).toBe("modal");
  });

  it("colocated implicit useKey fires when a disabled scope becomes enabled", () => {
    const handler = vi.fn();

    function Modal({ enabled }: { enabled: boolean }) {
      const scope = useScope("modal", { enabled });
      useKey("Escape", handler, { scope });
      return null;
    }

    const { rerender } = render(
      <Wrapper>
        <Modal enabled={false} />
      </Wrapper>,
    );

    act(() => pressKey("Escape"));
    expect(handler).not.toHaveBeenCalled();

    rerender(
      <Wrapper>
        <Modal enabled={true} />
      </Wrapper>,
    );

    act(() => pressKey("Escape"));
    expect(handler).toHaveBeenCalledOnce();
  });

  it("colocated useKey stops firing when an enabled scope becomes disabled, leaving no stale handlers", () => {
    const handler = vi.fn();

    function Modal({ enabled }: { enabled: boolean }) {
      const scope = useScope("modal", { enabled });
      useKey("Escape", handler, { scope });
      return null;
    }

    const { rerender } = render(
      <Wrapper>
        <Modal enabled={true} />
      </Wrapper>,
    );

    act(() => pressKey("Escape"));
    expect(handler).toHaveBeenCalledTimes(1);

    rerender(
      <Wrapper>
        <Modal enabled={false} />
      </Wrapper>,
    );

    act(() => pressKey("Escape"));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("parent global useKey mounted in same commit as sibling scope remains in global scope", () => {
    const parentHandler = vi.fn();
    const childHandler = vi.fn();

    function ParentKey() {
      useKey("o", parentHandler);
      return null;
    }

    function ChildScope() {
      const scope = useScope("modal");
      useKey("Escape", childHandler, { scope });
      return null;
    }

    function App() {
      return (
        <>
          <ParentKey />
          <ChildScope />
        </>
      );
    }

    render(
      <Wrapper>
        <App />
      </Wrapper>,
    );

    act(() => pressKey("o"));
    expect(parentHandler).not.toHaveBeenCalled();

    act(() => pressKey("Escape"));
    expect(childHandler).toHaveBeenCalledOnce();
  });

  it("parent useKey explicitly scoped to 'global' is unaffected by descendant scope pushes", () => {
    const parentHandler = vi.fn();
    const childHandler = vi.fn();

    function ChildWithScope() {
      const scope = useScope("modal");
      useKey("Escape", childHandler, { scope });
      return null;
    }

    function ParentWithKey() {
      useKey("o", parentHandler, { scope: "global" });
      return <ChildWithScope />;
    }

    render(
      <Wrapper>
        <ParentWithKey />
      </Wrapper>,
    );

    act(() => pressKey("o"));
    expect(parentHandler).not.toHaveBeenCalled();

    act(() => pressKey("Escape"));
    expect(childHandler).toHaveBeenCalledOnce();
  });

  it("parent global useKey resumes firing once a child scope unmounts and pops", () => {
    const parentHandler = vi.fn();
    const childHandler = vi.fn();

    function ParentKey() {
      useKey("o", parentHandler);
      return null;
    }

    function ChildScope() {
      useScope("modal");
      useKey("Escape", childHandler);
      return null;
    }

    function App({ open }: { open: boolean }) {
      return (
        <>
          <ParentKey />
          {open ? <ChildScope /> : null}
        </>
      );
    }

    const { rerender } = render(
      <Wrapper>
        <App open={false} />
      </Wrapper>,
    );

    act(() => pressKey("o"));
    expect(parentHandler).toHaveBeenCalledOnce();

    rerender(
      <Wrapper>
        <App open={true} />
      </Wrapper>,
    );

    act(() => pressKey("o"));
    expect(parentHandler).toHaveBeenCalledOnce();

    act(() => pressKey("Escape"));
    expect(childHandler).toHaveBeenCalledOnce();

    rerender(
      <Wrapper>
        <App open={false} />
      </Wrapper>,
    );

    act(() => pressKey("o"));
    expect(parentHandler).toHaveBeenCalledTimes(2);
  });

  it("survives StrictMode mount → unmount → mount cycles without leaking handlers", () => {
    const handler = vi.fn();

    function Consumer() {
      const scope = useScope("modal");
      useKey("Escape", handler, { scope });
      return null;
    }

    function StrictWrapper({ children }: { children: ReactNode }) {
      return (
        <StrictMode>
          <KeyboardProvider>{children}</KeyboardProvider>
        </StrictMode>
      );
    }

    const { unmount } = render(
      <StrictWrapper>
        <Consumer />
      </StrictWrapper>,
    );

    act(() => pressKey("Escape"));
    expect(handler).toHaveBeenCalledTimes(1);

    unmount();

    act(() => pressKey("Escape"));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("disabling and re-enabling within StrictMode does not leave duplicate registrations", () => {
    const handler = vi.fn();

    function Consumer({ enabled }: { enabled: boolean }) {
      const scope = useScope("modal", { enabled });
      useKey("Escape", handler, { scope });
      return null;
    }

    function StrictWrapper({ children }: { children: ReactNode }) {
      return (
        <StrictMode>
          <KeyboardProvider>{children}</KeyboardProvider>
        </StrictMode>
      );
    }

    const { rerender } = render(
      <StrictWrapper>
        <Consumer enabled={true} />
      </StrictWrapper>,
    );

    act(() => pressKey("Escape"));
    expect(handler).toHaveBeenCalledTimes(1);

    rerender(
      <StrictWrapper>
        <Consumer enabled={false} />
      </StrictWrapper>,
    );

    act(() => pressKey("Escape"));
    expect(handler).toHaveBeenCalledTimes(1);

    rerender(
      <StrictWrapper>
        <Consumer enabled={true} />
      </StrictWrapper>,
    );

    act(() => pressKey("Escape"));
    expect(handler).toHaveBeenCalledTimes(2);
  });
});
