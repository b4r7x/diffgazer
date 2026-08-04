// @vitest-environment jsdom

import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentType, LazyExoticComponent } from "react";
import { lazy } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DemoPreview } from "@/components/demo-preview";
import { PreviewModeProvider } from "@/components/preview-mode-context";
import { ThemeProvider } from "@/hooks/theme-context";
import type { PreviewFrame } from "@/lib/example-frames";

function renderPreview({
  frame = "default",
  rawCode = "const example = <Button />;",
  demo = null,
  loading = false,
}: {
  frame?: PreviewFrame;
  rawCode?: string;
  demo?: LazyExoticComponent<ComponentType> | null;
  loading?: boolean;
} = {}) {
  return render(
    <ThemeProvider>
      <DemoPreview demo={demo} loading={loading} code={[]} rawCode={rawCode} frame={frame} />
    </ThemeProvider>,
  );
}

// The "Preview" tab trigger always renders, so match the chrome label by
// excluding the tablist copy.
function chromeLabels() {
  return screen.queryAllByText("Preview").filter((el) => el.closest('[role="tab"]') === null);
}

describe("DemoPreview default (specimen) frame", () => {
  it("shows a loading indicator on the first render while the demo index loads", () => {
    renderPreview({ loading: true });

    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });

  it("renders the PREVIEW chrome label above the stage", () => {
    renderPreview();
    expect(chromeLabels()).toHaveLength(1);
  });

  it("renders the copy-tsx footer action when source is available", () => {
    renderPreview({ rawCode: "const example = <Button />;" });
    expect(screen.getByText("[copy tsx]")).toBeInTheDocument();
  });

  it("hides the copy-tsx footer action when source is empty", () => {
    renderPreview({ rawCode: "" });
    expect(screen.queryByText("[copy tsx]")).not.toBeInTheDocument();
  });

  it("keeps the frame chrome for the compact single-line frame", () => {
    renderPreview({ frame: "compact" });
    expect(chromeLabels()).toHaveLength(1);
    expect(screen.getByText("[copy tsx]")).toBeInTheDocument();
  });
});

describe("DemoPreview inset/fill frames", () => {
  const WorkingDemo = lazy(async () => ({ default: () => <p>Working preview</p> }));

  it("leaves the inset frame free of panel chrome", async () => {
    renderPreview({ frame: "inset", demo: WorkingDemo });
    expect(screen.getByText(/sidebar in context/i)).toBeInTheDocument();
    expect(chromeLabels()).toHaveLength(0);
    expect(screen.queryByText("[copy tsx]")).not.toBeInTheDocument();
    expect(await screen.findByText("Working preview")).toBeInTheDocument();
  });

  it("leaves the fill frame free of panel chrome", async () => {
    renderPreview({ frame: "fill", demo: WorkingDemo });
    expect(chromeLabels()).toHaveLength(0);
    expect(screen.queryByText("[copy tsx]")).not.toBeInTheDocument();
    expect(await screen.findByText("Working preview")).toBeInTheDocument();
  });
});

describe("DemoPreview stage overflow", () => {
  const WorkingDemo = lazy(async () => ({ default: () => <p>Working preview</p> }));
  const RealResizeObserver = globalThis.ResizeObserver;

  afterEach(() => {
    globalThis.ResizeObserver = RealResizeObserver;
    vi.restoreAllMocks();
  });

  // Tab trigger → tab panel → the stop after it. The stage is that stop while it
  // is in the tab order; otherwise tabbing walks straight past it.
  async function tabPastTheTabPanel(user: ReturnType<typeof userEvent.setup>) {
    screen.getByRole("tab", { name: "Preview" }).focus();
    await user.tab();
    await user.tab();
  }

  function overflowEveryElement() {
    vi.spyOn(Element.prototype, "scrollWidth", "get").mockReturnValue(720);
  }

  it.each<PreviewFrame>([
    "default",
    "compact",
    "fill",
  ])("keeps the %s stage out of the tab order while the example fits", async (frame) => {
    const user = userEvent.setup();
    renderPreview({ frame, demo: WorkingDemo });
    expect(await screen.findByText("Working preview")).toBeInTheDocument();

    const stage = screen.getByRole("region", { name: "Example preview" });
    expect(within(stage).getByText("Working preview")).toBeInTheDocument();

    await tabPastTheTabPanel(user);
    expect(stage).not.toHaveFocus();
  });

  it.each<PreviewFrame>([
    "default",
    "compact",
    "fill",
  ])("makes the %s stage a keyboard-reachable scroll region once the example overflows", async (frame) => {
    overflowEveryElement();
    const user = userEvent.setup();
    renderPreview({ frame, demo: WorkingDemo });
    expect(await screen.findByText("Working preview")).toBeInTheDocument();

    const stages = screen.getAllByRole("region", { name: "Example preview" });
    expect(stages).toHaveLength(1);

    await tabPastTheTabPanel(user);
    expect(stages[0]).toHaveFocus();
  });

  it("hands the stage its tab stop when a resize turns it into a scroller", async () => {
    const resizeCallbacks: Array<() => void> = [];
    globalThis.ResizeObserver = class {
      constructor(callback: () => void) {
        resizeCallbacks.push(callback);
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;

    const user = userEvent.setup();
    renderPreview({ demo: WorkingDemo });
    expect(await screen.findByText("Working preview")).toBeInTheDocument();

    const stage = screen.getByRole("region", { name: "Example preview" });
    await tabPastTheTabPanel(user);
    expect(stage).not.toHaveFocus();

    overflowEveryElement();
    act(() => {
      for (const notifyResize of resizeCallbacks) notifyResize();
    });

    await tabPastTheTabPanel(user);
    expect(stage).toHaveFocus();
  });
});

describe("DemoPreview import failures", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each<PreviewFrame>([
    "default",
    "compact",
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

describe("DemoPreview frame", () => {
  // A rendered example shows only its own chrome: the stage frames it with a
  // plain hairline, so a bracketed demo never sits inside a second bracket set.
  it("frames the default preview stage without corner brackets", () => {
    renderPreview();

    const panel = document.querySelector('[data-slot="panel"]');
    expect(panel).not.toBeNull();
    expect(panel).toHaveAttribute("data-frame", "hairline");
    expect(document.querySelector('[data-slot="panel-corners"]')).toBeNull();
  });
});

describe("DemoPreview page mode", () => {
  function TwoExamples() {
    return (
      <ThemeProvider>
        <PreviewModeProvider>
          <DemoPreview
            title="First"
            demo={null}
            code={[{ number: 1, content: "const first = 1" }]}
            rawCode="const first = 1"
          />
          <DemoPreview
            title="Second"
            demo={null}
            code={[{ number: 1, content: "const second = 2" }]}
            rawCode="const second = 2"
          />
        </PreviewModeProvider>
      </ThemeProvider>
    );
  }

  it("switches every example on the page from any one strip", async () => {
    const user = userEvent.setup();
    render(<TwoExamples />);

    const [firstCode, secondCode] = screen.getAllByRole("tab", { name: "Code" });
    if (!firstCode || !secondCode) throw new Error("code triggers missing");

    await user.click(secondCode);

    expect(await screen.findByText("const first = 1")).toBeInTheDocument();
    expect(screen.getByText("const second = 2")).toBeInTheDocument();
    for (const trigger of screen.getAllByRole("tab", { name: "Preview" })) {
      expect(trigger).toHaveAttribute("aria-selected", "false");
    }
  });

  it("opens on the preview again for a freshly mounted page", async () => {
    const user = userEvent.setup();
    const first = render(<TwoExamples />);
    const codeTrigger = screen.getAllByRole("tab", { name: "Code" })[0];
    if (!codeTrigger) throw new Error("code trigger missing");
    await user.click(codeTrigger);
    first.unmount();

    render(<TwoExamples />);
    for (const trigger of screen.getAllByRole("tab", { name: "Preview" })) {
      expect(trigger).toHaveAttribute("aria-selected", "true");
    }
  });

  it("keeps a standalone example switching on its own", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <DemoPreview
          demo={null}
          code={[{ number: 1, content: "const alone = true" }]}
          rawCode="const alone = true"
        />
      </ThemeProvider>,
    );

    await user.click(screen.getByRole("tab", { name: "Code" }));
    expect(await screen.findByText("const alone = true")).toBeInTheDocument();
  });

  it("keeps the clicked example stationary when examples above it change height", async () => {
    const user = userEvent.setup();
    const scrollBy = vi.fn();
    vi.stubGlobal("scrollBy", scrollBy);
    render(<TwoExamples />);

    const secondCode = screen.getAllByRole("tab", { name: "Code" })[1];
    if (!secondCode) throw new Error("code trigger missing");
    const secondRoot = secondCode.closest('[data-slot="demo-preview"]');
    if (!(secondRoot instanceof HTMLElement)) throw new Error("example root missing");

    const tops = [300, 120];
    vi.spyOn(secondRoot, "getBoundingClientRect").mockImplementation(
      () => ({ top: tops.shift() ?? 120 }) as DOMRect,
    );

    await user.click(secondCode);

    expect(scrollBy).toHaveBeenCalledWith({ top: -180, behavior: "instant" });
    vi.unstubAllGlobals();
  });
});
