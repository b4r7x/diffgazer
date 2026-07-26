import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PreviewModeProvider, usePreviewMode } from "@/components/preview-mode-context";

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
});
