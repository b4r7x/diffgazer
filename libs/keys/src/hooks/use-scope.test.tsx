import { describe, it, expect, vi, afterEach } from "vitest";
import { render, renderHook, cleanup, act } from "@testing-library/react";
import { useEffect, type ReactNode } from "react";
import { KeyboardProvider } from "../providers/keyboard-provider";
import { useKeyboardContext } from "../context/keyboard-context";
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

  it("throws when used outside KeyboardProvider", () => {
    expect(() => {
      renderHook(() => useScope("modal"));
    }).toThrow("useKeyboardContext must be used within KeyboardProvider");
  });
});
