/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import type { Shortcut } from "../schemas/presentation/index.js";
import { FooterProvider, useFooterActions, useFooterData } from "./provider.js";
import { usePageFooter } from "./use-page-footer.js";

function wrapper({ children }: { children: ReactNode }) {
  return createElement(FooterProvider, null, children);
}

describe("usePageFooter", () => {
  it("publishes left and right shortcuts to footer data", () => {
    const shortcuts: Shortcut[] = [{ key: "Enter", label: "Confirm" }];
    const rightShortcuts: Shortcut[] = [{ key: "Esc", label: "Back" }];

    const { result } = renderHook(
      () => {
        usePageFooter({ shortcuts, rightShortcuts });
        return useFooterData();
      },
      { wrapper },
    );

    expect(result.current.shortcuts).toEqual(shortcuts);
    expect(result.current.rightShortcuts).toEqual(rightShortcuts);
  });

  it("reactively replaces shortcuts when input changes between renders", () => {
    const first: Shortcut[] = [{ key: "Enter", label: "Confirm" }];
    const second: Shortcut[] = [{ key: "Enter", label: "Submit" }];

    const { result, rerender } = renderHook(
      ({ shortcuts }: { shortcuts: Shortcut[] }) => {
        usePageFooter({ shortcuts });
        return useFooterData();
      },
      { wrapper, initialProps: { shortcuts: first } },
    );

    expect(result.current.shortcuts).toEqual(first);

    rerender({ shortcuts: second });
    expect(result.current.shortcuts).toEqual(second);
  });

  it("keeps the actions reference stable across data changes (split contract)", () => {
    const { result } = renderHook(() => ({ actions: useFooterActions(), data: useFooterData() }), {
      wrapper,
    });

    const initialActions = result.current.actions;

    act(() => {
      result.current.actions.setShortcuts([{ key: "Enter", label: "Confirm" }]);
    });
    expect(result.current.actions).toBe(initialActions);

    act(() => {
      result.current.actions.setRightShortcuts([{ key: "Esc", label: "Back" }]);
    });
    expect(result.current.actions).toBe(initialActions);
  });
});
