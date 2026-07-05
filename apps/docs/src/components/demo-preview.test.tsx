// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DemoPreview } from "@/components/demo-preview";
import { ThemeProvider } from "@/hooks/theme-context";
import type { PreviewFrame } from "@/lib/example-frames";

function renderPreview({
  frame = "default",
  rawCode = "const example = <Button />;",
}: {
  frame?: PreviewFrame;
  rawCode?: string;
} = {}) {
  return render(
    <ThemeProvider>
      <DemoPreview demo={null} code={[]} rawCode={rawCode} frame={frame} />
    </ThemeProvider>,
  );
}

// The "Preview" tab trigger always renders, so match the chrome label by
// excluding the tablist copy.
function chromeLabels() {
  return screen.queryAllByText("Preview").filter((el) => el.closest('[role="tab"]') === null);
}

describe("DemoPreview default (viewfinder) frame", () => {
  it("renders the PREVIEW chrome label above the stage", () => {
    renderPreview();
    expect(chromeLabels()).toHaveLength(1);
  });

  it("renders the copy-jsx footer action when source is available", () => {
    renderPreview({ rawCode: "const example = <Button />;" });
    expect(screen.getByText("[copy jsx]")).toBeInTheDocument();
  });

  it("hides the copy-jsx footer action when source is empty", () => {
    renderPreview({ rawCode: "" });
    expect(screen.queryByText("[copy jsx]")).not.toBeInTheDocument();
  });
});

describe("DemoPreview inset/fill frames", () => {
  it("leaves the inset frame free of viewfinder chrome", () => {
    renderPreview({ frame: "inset" });
    expect(screen.getByText(/sidebar in context/i)).toBeInTheDocument();
    expect(chromeLabels()).toHaveLength(0);
    expect(screen.queryByText("[copy jsx]")).not.toBeInTheDocument();
  });

  it("leaves the fill frame free of viewfinder chrome", () => {
    renderPreview({ frame: "fill" });
    expect(chromeLabels()).toHaveLength(0);
    expect(screen.queryByText("[copy jsx]")).not.toBeInTheDocument();
  });
});
