import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef } from "react";
import { describe, expect, it } from "vitest";
import { PreviewModeProvider, usePreviewMode } from "@/components/preview-mode-context";
import { MAIN_SCROLL_RESTORATION_ID } from "@/lib/main-scroll-bootstrap";

/** Mirrors DemoPreview: the clicked strip hands the provider its own root as the anchor. */
function ExampleStrip() {
  const shared = usePreviewMode();
  const rootRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={rootRef}>
      <button type="button" onClick={() => shared?.setMode("code", rootRef.current)}>
        Code
      </button>
    </div>
  );
}

/** jsdom stores scrollTop but implements no Element.scrollBy, so the container gets one. */
function trackScrolling(container: HTMLElement) {
  Object.defineProperty(container, "scrollBy", {
    configurable: true,
    value: ({ top = 0 }: ScrollToOptions) => {
      container.scrollTop += top;
    },
  });
}

/** jsdom lays nothing out; these are the tops a real height change above the anchor produces. */
function anchorTops(anchor: HTMLElement, tops: number[]) {
  anchor.getBoundingClientRect = () => new DOMRect(0, tops.shift() ?? 0);
}

describe("PreviewModeProvider", () => {
  it("holds the context value identity steady while the mode is unchanged", () => {
    const seen: unknown[] = [];

    function Probe() {
      seen.push(usePreviewMode());
      return null;
    }

    const view = render(
      <PreviewModeProvider>
        <Probe />
      </PreviewModeProvider>,
    );
    view.rerender(
      <PreviewModeProvider>
        <Probe />
      </PreviewModeProvider>,
    );

    expect(seen.length).toBeGreaterThan(1);
    expect(new Set(seen).size).toBe(1);
  });

  it("keeps the clicked example stationary by scrolling the article container", async () => {
    const user = userEvent.setup();
    render(
      <main id={MAIN_SCROLL_RESTORATION_ID}>
        <PreviewModeProvider>
          <ExampleStrip />
        </PreviewModeProvider>
      </main>,
    );

    const article = screen.getByRole("main");
    trackScrolling(article);
    const trigger = screen.getByRole("button", { name: "Code" });
    const strip = trigger.parentElement;
    if (!(strip instanceof HTMLElement)) throw new Error("example root missing");
    anchorTops(strip, [120, 300]);

    await user.click(trigger);

    expect(article.scrollTop).toBe(180);
  });
});
