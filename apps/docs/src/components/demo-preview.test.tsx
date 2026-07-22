// @vitest-environment jsdom

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentType, LazyExoticComponent } from "react";
import { lazy } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DemoPreview } from "@/components/demo-preview";
import { ThemeProvider } from "@/hooks/theme-context";
import type { PreviewFrame } from "@/lib/example-frames";

function renderPreview({
  frame = "default",
  rawCode = "const example = <Button />;",
  demo = null,
}: {
  frame?: PreviewFrame;
  rawCode?: string;
  demo?: LazyExoticComponent<ComponentType> | null;
} = {}) {
  return render(
    <ThemeProvider>
      <DemoPreview demo={demo} code={[]} rawCode={rawCode} frame={frame} />
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
  const WorkingDemo = lazy(async () => ({ default: () => <p>Working preview</p> }));

  it("leaves the inset frame free of viewfinder chrome", async () => {
    renderPreview({ frame: "inset", demo: WorkingDemo });
    expect(screen.getByText(/sidebar in context/i)).toBeInTheDocument();
    expect(chromeLabels()).toHaveLength(0);
    expect(screen.queryByText("[copy jsx]")).not.toBeInTheDocument();
    expect(await screen.findByText("Working preview")).toBeInTheDocument();
  });

  it("leaves the fill frame free of viewfinder chrome", async () => {
    renderPreview({ frame: "fill", demo: WorkingDemo });
    expect(chromeLabels()).toHaveLength(0);
    expect(screen.queryByText("[copy jsx]")).not.toBeInTheDocument();
    expect(await screen.findByText("Working preview")).toBeInTheDocument();
  });
});

describe("DemoPreview import failures", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each<PreviewFrame>([
    "default",
    "fill",
    "inset",
  ])("isolates a rejected %s preview while keeping the page and source readable", async (frame) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();
    const RejectedDemo = lazy(() => Promise.reject(new Error("demo bundle failed")));
    const WorkingDemo = lazy(async () => ({ default: () => <p>Working preview</p> }));

    render(
      <ThemeProvider>
        <h1>Component guide</h1>
        <p>Surrounding documentation remains readable.</p>
        <section aria-label="Rejected example">
          <DemoPreview
            title="Rejected example"
            demo={RejectedDemo}
            code={[{ number: 1, content: "const rejected = true" }]}
            rawCode="const rejected = true"
            frame={frame}
          />
        </section>
        <section aria-label="Working example">
          <DemoPreview title="Working example" demo={WorkingDemo} code={[]} rawCode="" />
        </section>
      </ThemeProvider>,
    );

    expect(await screen.findByText("Preview unavailable.")).toBeInTheDocument();
    expect(await screen.findByText("Working preview")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Component guide" })).toBeInTheDocument();
    expect(screen.getByText("Surrounding documentation remains readable.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();

    const rejectedExample = screen.getByRole("region", { name: "Rejected example" });
    await user.click(within(rejectedExample).getByRole("tab", { name: "Code" }));
    await waitFor(() => {
      expect(within(rejectedExample).getByText("const rejected = true")).toBeInTheDocument();
    });
  });
});
