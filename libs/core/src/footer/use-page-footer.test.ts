/**
 * @vitest-environment jsdom
 */
import { cleanup, render, renderHook, screen, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import type { Shortcut } from "../schemas/presentation/index.js";
import { FooterProvider, useFooterData } from "./provider.js";
import { usePageFooter } from "./use-page-footer.js";

function wrapper({ children }: { children: ReactNode }) {
  return createElement(FooterProvider, null, children);
}

const PAGE_SHORTCUTS: Shortcut[] = [{ key: "Enter", label: "Run action" }];
const PAGE_RIGHT_SHORTCUTS: Shortcut[] = [{ key: "Esc", label: "Back" }];

function FooterPublisher() {
  usePageFooter({ shortcuts: PAGE_SHORTCUTS, rightShortcuts: PAGE_RIGHT_SHORTCUTS });
  return createElement("div", null, "page with footer");
}

function FooterStateView() {
  const { shortcuts, rightShortcuts } = useFooterData();
  return createElement(
    "output",
    { "aria-label": "Footer state" },
    JSON.stringify({ shortcuts, rightShortcuts }),
  );
}

describe("usePageFooter", () => {
  afterEach(cleanup);

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

  it("keeps the last page shortcuts when a healthy page unmounts", async () => {
    function View({ showPublisher }: { showPublisher: boolean }) {
      return createElement(
        FooterProvider,
        null,
        createElement(FooterStateView),
        showPublisher
          ? createElement(FooterPublisher)
          : createElement("div", null, "next healthy page"),
      );
    }

    function readFooterState() {
      const text = screen.getByRole("status", { name: "Footer state" }).textContent ?? "";
      return JSON.parse(text) as { shortcuts: Shortcut[]; rightShortcuts: Shortcut[] };
    }

    const { rerender } = render(createElement(View, { showPublisher: true }));
    await waitFor(() => expect(readFooterState().shortcuts).toEqual(PAGE_SHORTCUTS));

    rerender(createElement(View, { showPublisher: false }));

    expect(readFooterState().shortcuts).toEqual(PAGE_SHORTCUTS);
    expect(readFooterState().rightShortcuts).toEqual(PAGE_RIGHT_SHORTCUTS);
  });
});
