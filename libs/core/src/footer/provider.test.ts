/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { MAIN_MENU_SHORTCUTS, type Shortcut } from "../schemas/presentation/index.js";
import { FooterProvider, useFooterActions, useFooterData } from "./provider.js";

function wrapper({ children }: { children: ReactNode }) {
  return createElement(FooterProvider, null, children);
}

function wrapperWithInitial({
  initialShortcuts,
}: {
  initialShortcuts: Shortcut[];
}) {
  return ({ children }: { children: ReactNode }) =>
    createElement(FooterProvider, { initialShortcuts, children });
}

describe("FooterProvider", () => {
  it("exposes default left shortcut row to data consumers", () => {
    const { result } = renderHook(() => useFooterData(), { wrapper });
    expect(result.current.shortcuts).toEqual([{ key: "?", label: "Help" }]);
    expect(result.current.rightShortcuts).toEqual([]);
  });

  it("accepts initial shortcuts for tests and embedded scenarios", () => {
    const initial: Shortcut[] = [{ key: "Enter", label: "Confirm" }];
    const { result } = renderHook(() => useFooterData(), {
      wrapper: wrapperWithInitial({ initialShortcuts: initial }),
    });
    expect(result.current.shortcuts).toEqual(initial);
  });

  it("updates data when actions setShortcuts is called with a different array", () => {
    const { result } = renderHook(
      () => ({ data: useFooterData(), actions: useFooterActions() }),
      { wrapper },
    );

    act(() => {
      result.current.actions.setShortcuts([{ key: "Enter", label: "Confirm" }]);
    });
    expect(result.current.data.shortcuts).toEqual([{ key: "Enter", label: "Confirm" }]);

    act(() => {
      result.current.actions.setRightShortcuts([{ key: "Esc", label: "Back" }]);
    });
    expect(result.current.data.rightShortcuts).toEqual([{ key: "Esc", label: "Back" }]);
  });

  it("skips the state update when next shortcuts are content-equal (referential stability)", () => {
    const { result } = renderHook(
      () => ({ data: useFooterData(), actions: useFooterActions() }),
      { wrapper },
    );

    act(() => {
      result.current.actions.setShortcuts([{ key: "Enter", label: "Confirm" }]);
    });
    const firstRef = result.current.data.shortcuts;

    act(() => {
      // Identical content, fresh array — should be guarded out.
      result.current.actions.setShortcuts([{ key: "Enter", label: "Confirm" }]);
    });
    expect(result.current.data.shortcuts).toBe(firstRef);
  });

  it("throws when data hook used without provider", () => {
    expect(() => renderHook(() => useFooterData())).toThrow(/FooterProvider/);
  });

  it("throws when actions hook used without provider", () => {
    expect(() => renderHook(() => useFooterActions())).toThrow(/FooterProvider/);
  });
});

describe("MAIN_MENU_SHORTCUTS", () => {
  it("uses the canonical Navigate/Select/Quit wording", () => {
    expect(MAIN_MENU_SHORTCUTS).toEqual([
      { key: "↑/↓", label: "Navigate" },
      { key: "Enter", label: "Select" },
      { key: "q", label: "Quit" },
    ]);
  });
});
