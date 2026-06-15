import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FloatingAlign, FloatingSide } from "@/hooks/use-floating-position";
import { axe } from "../../../testing/axe";
import { applyReducedMotionFixture } from "../../../testing/prefers-reduced-motion";
import { FloatingPanel, useFloatingPanelContext } from "./index";

interface TriggerRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// jsdom returns zeroed DOMRects for unlaid-out elements; FloatingPanel needs concrete
// trigger coordinates to resolve placement, so each harness stubs the trigger's
// getBoundingClientRect with a fixed rect.
function mountTriggerRect(node: HTMLElement | null, rect: TriggerRect) {
  if (!node) return;
  const { x, y, width, height } = rect;
  node.getBoundingClientRect = () =>
    ({
      x,
      y,
      left: x,
      top: y,
      right: x + width,
      bottom: y + height,
      width,
      height,
      toJSON: () => ({}),
    }) as DOMRect;
}

interface HarnessProps {
  initialOpen?: boolean;
  side?: FloatingSide;
  align?: FloatingAlign;
  alignOffset?: number;
  matchTriggerWidth?: boolean;
  avoidCollisions?: boolean;
  exitFallbackMs?: number;
  portalContainer?: Element | null;
  onExitComplete?: () => void;
  panelLabel?: string;
  panelRole?: string;
  panelId?: string;
  triggerWidth?: number;
  triggerHeight?: number;
  triggerX?: number;
  triggerY?: number;
  onPanelKeyDown?: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  onPanelMouseEnter?: () => void;
  onPanelMouseLeave?: () => void;
  panelRefCallback?: (node: HTMLDivElement | null) => void;
}

function Harness({
  initialOpen = false,
  side = "bottom",
  align = "center",
  alignOffset,
  matchTriggerWidth = false,
  avoidCollisions = false,
  exitFallbackMs,
  portalContainer,
  onExitComplete,
  panelLabel = "panel",
  panelRole = "dialog",
  panelId = "test-panel",
  triggerWidth = 140,
  triggerHeight = 32,
  triggerX = 100,
  triggerY = 100,
  onPanelKeyDown,
  onPanelMouseEnter,
  onPanelMouseLeave,
  panelRefCallback,
}: HarnessProps) {
  const [open, setOpen] = useState(initialOpen);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  return (
    <>
      <button
        type="button"
        ref={(node) => {
          triggerRef.current = node;
          mountTriggerRect(node, {
            x: triggerX,
            y: triggerY,
            width: triggerWidth,
            height: triggerHeight,
          });
        }}
        onClick={() => setOpen((v) => !v)}
      >
        toggle
      </button>
      <FloatingPanel
        open={open}
        triggerRef={triggerRef}
        side={side}
        align={align}
        alignOffset={alignOffset}
        matchTriggerWidth={matchTriggerWidth}
        portalContainer={portalContainer ?? undefined}
        onExitComplete={onExitComplete}
        avoidCollisions={avoidCollisions}
        exitFallbackMs={exitFallbackMs}
        sideOffset={4}
        role={panelRole}
        aria-label={panelLabel}
        id={panelId}
        tabIndex={-1}
        onKeyDown={onPanelKeyDown}
        onMouseEnter={onPanelMouseEnter}
        onMouseLeave={onPanelMouseLeave}
        ref={panelRefCallback}
      >
        panel body
      </FloatingPanel>
    </>
  );
}

describe("FloatingPanel presence", () => {
  it("renders nothing when closed and mounts content after open flips", async () => {
    render(<Harness panelLabel="presence" />);
    expect(screen.queryByRole("dialog", { name: "presence" })).not.toBeInTheDocument();

    await act(async () => {
      screen.getByRole("button", { name: "toggle" }).click();
    });

    expect(screen.getByRole("dialog", { name: "presence" })).toBeInTheDocument();
  });

  it("fires onExitComplete after the exit animation finishes", async () => {
    const onExitComplete = vi.fn();
    render(<Harness initialOpen panelLabel="exit-complete" onExitComplete={onExitComplete} />);
    const panel = await screen.findByRole("dialog", { name: "exit-complete" });

    await act(async () => {
      screen.getByRole("button", { name: "toggle" }).click();
    });
    expect(onExitComplete).not.toHaveBeenCalled();

    await act(async () => {
      // fireEvent retained: animationEnd has no userEvent equivalent.
      fireEvent.animationEnd(panel);
    });
    expect(onExitComplete).toHaveBeenCalledTimes(1);
  });

  it("ignores animationend events bubbling from descendants", async () => {
    function PanelWithAnimatedChild() {
      const [open, setOpen] = useState(true);
      const triggerRef = useRef<HTMLButtonElement | null>(null);
      return (
        <>
          <button
            type="button"
            ref={(node) => {
              triggerRef.current = node;
              mountTriggerRect(node, { x: 0, y: 0, width: 100, height: 32 });
            }}
            onClick={() => setOpen((v) => !v)}
          >
            toggle
          </button>
          <FloatingPanel open={open} triggerRef={triggerRef} role="dialog" aria-label="bubble">
            <span>child</span>
          </FloatingPanel>
        </>
      );
    }

    render(<PanelWithAnimatedChild />);
    const panel = await screen.findByRole("dialog", { name: "bubble" });
    const inner = screen.getByText("child");

    await act(async () => {
      // fireEvent retained: animationEnd has no userEvent equivalent.
      fireEvent.animationEnd(inner);
    });

    expect(panel).toBeInTheDocument();
    expect(panel).toHaveAttribute("data-state", "open");
  });
});

describe("FloatingPanel positioning attributes", () => {
  it.each<[FloatingSide, FloatingAlign, string]>([
    ["bottom", "end", "top right"],
    ["top", "start", "bottom left"],
    ["left", "center", "right center"],
  ])("reflects resolved side=%s align=%s with positioned flag and transform-origin %s", async (side, align, expectedOrigin) => {
    render(
      <Harness initialOpen side={side} align={align} panelLabel={`origin-${side}-${align}`} />,
    );
    const panel = await screen.findByRole("dialog", { name: `origin-${side}-${align}` });

    expect(panel).toHaveAttribute("data-side", side);
    expect(panel).toHaveAttribute("data-align", align);
    expect(panel).toHaveAttribute("data-positioned", "");
    expect(panel.style.getPropertyValue("--ui-content-transform-origin")).toBe(expectedOrigin);
  });

  it("exposes --ui-floating-trigger-width only when matchTriggerWidth is true", async () => {
    const { unmount } = render(
      <Harness initialOpen matchTriggerWidth triggerWidth={213} panelLabel="match-width" />,
    );
    expect(
      (await screen.findByRole("dialog", { name: "match-width" })).style.getPropertyValue(
        "--ui-floating-trigger-width",
      ),
    ).toBe("213px");
    unmount();

    render(<Harness initialOpen panelLabel="no-match" />);
    expect(
      (await screen.findByRole("dialog", { name: "no-match" })).style.getPropertyValue(
        "--ui-floating-trigger-width",
      ),
    ).toBe("");
  });

  it("exposes finite available-size CSS variables for the resolved side", async () => {
    render(<Harness initialOpen side="bottom" panelLabel="avail" />);
    const panel = await screen.findByRole("dialog", { name: "avail" });

    const height = panel.style.getPropertyValue("--floating-panel-available-height");
    const width = panel.style.getPropertyValue("--floating-panel-available-width");
    // Both vars are present with finite positive px derived from the viewport.
    expect(height).toMatch(/^\d+(\.\d+)?px$/);
    expect(width).toMatch(/^\d+(\.\d+)?px$/);
    expect(Number.parseFloat(height)).toBeGreaterThan(0);
    expect(Number.parseFloat(width)).toBeGreaterThan(0);
  });

  it("exposes positioned/side/align to descendants via useFloatingPanelContext", async () => {
    function ContextProbe() {
      const { positioned, side, align } = useFloatingPanelContext();
      return (
        <output aria-label="Floating panel context">
          {positioned ? "positioned" : "unpositioned"} {side ?? "none"} {align ?? "none"}
        </output>
      );
    }

    function ContextHarness() {
      const [open] = useState(true);
      const triggerRef = useRef<HTMLButtonElement | null>(null);
      return (
        <>
          <button
            type="button"
            ref={(node) => {
              triggerRef.current = node;
              mountTriggerRect(node, { x: 50, y: 60, width: 100, height: 32 });
            }}
          >
            t
          </button>
          <FloatingPanel
            open={open}
            triggerRef={triggerRef}
            side="top"
            align="end"
            avoidCollisions={false}
            role="dialog"
            aria-label="context-probe"
          >
            <ContextProbe />
          </FloatingPanel>
        </>
      );
    }

    render(<ContextHarness />);
    expect(await screen.findByRole("status", { name: "Floating panel context" })).toHaveTextContent(
      "positioned top end",
    );
  });
});

describe("FloatingPanel portal target", () => {
  it("renders into an explicit portalContainer when supplied", () => {
    const portalHost = document.createElement("div");
    portalHost.id = "portal-host";
    document.body.appendChild(portalHost);

    render(<Harness initialOpen portalContainer={portalHost} panelLabel="portal" />);
    const panel = screen.getByRole("dialog", { name: "portal" });

    expect(portalHost.contains(panel)).toBe(true);
    portalHost.remove();
  });

  it("falls back to document.body when no portalContainer is supplied", () => {
    render(<Harness initialOpen panelLabel="default-portal" />);
    const panel = screen.getByRole("dialog", { name: "default-portal" });
    expect(panel.parentElement).toBe(document.body);
  });
});

describe("FloatingPanel prop forwarding", () => {
  it("forwards handlers, ref, and preserves role/aria-label/id/tabIndex on the panel element", async () => {
    const user = userEvent.setup();
    const onKeyDown = vi.fn();
    const onMouseEnter = vi.fn();
    const onMouseLeave = vi.fn();
    const refSpy = vi.fn();
    render(
      <Harness
        initialOpen
        panelLabel="forward"
        panelId="custom-id"
        panelRole="menu"
        onPanelKeyDown={onKeyDown}
        onPanelMouseEnter={onMouseEnter}
        onPanelMouseLeave={onMouseLeave}
        panelRefCallback={refSpy}
      />,
    );
    const panel = await screen.findByRole("menu", { name: "forward" });

    panel.focus();
    await user.keyboard("{Escape}");
    await user.hover(panel);
    await user.unhover(panel);

    expect(onKeyDown).toHaveBeenCalledTimes(1);
    expect(onMouseEnter).toHaveBeenCalledTimes(1);
    expect(onMouseLeave).toHaveBeenCalledTimes(1);
    expect(refSpy).toHaveBeenCalledWith(panel);
    expect(panel).toHaveAttribute("id", "custom-id");
    expect(panel).toHaveAttribute("tabIndex", "-1");
  });

  it("merges caller style with internal positioning, letting visuals pass through while structural keys stay internal", () => {
    function StyledHarness() {
      const [open] = useState(true);
      const triggerRef = useRef<HTMLButtonElement | null>(null);
      return (
        <>
          <button
            type="button"
            ref={(node) => {
              triggerRef.current = node;
              mountTriggerRect(node, { x: 10, y: 20, width: 100, height: 32 });
            }}
          >
            t
          </button>
          <FloatingPanel
            open={open}
            triggerRef={triggerRef}
            avoidCollisions={false}
            role="dialog"
            aria-label="styled"
            style={{
              position: "absolute",
              top: 999,
              left: 999,
              visibility: "hidden",
              backgroundColor: "rgb(0, 128, 255)",
            }}
          >
            x
          </FloatingPanel>
        </>
      );
    }

    render(<StyledHarness />);
    const panel = screen.getByRole("dialog", { name: "styled" });
    expect(panel.style.backgroundColor).toBe("rgb(0, 128, 255)");
    expect(panel.style.position).toBe("fixed");
    expect(panel.style.top).not.toBe("999px");
    expect(panel.style.left).not.toBe("999px");
    expect(panel.style.visibility).not.toBe("hidden");
  });
});

describe("FloatingPanel dev-mode a11y warning", () => {
  function UnlabeledHarness({ ariaLabelledBy }: { ariaLabelledBy?: string }) {
    const [open] = useState(true);
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    return (
      <>
        {ariaLabelledBy ? <h2 id={ariaLabelledBy}>External heading</h2> : null}
        <button
          type="button"
          ref={(node) => {
            triggerRef.current = node;
            mountTriggerRect(node, { x: 0, y: 0, width: 50, height: 20 });
          }}
        >
          t
        </button>
        <FloatingPanel
          open={open}
          triggerRef={triggerRef}
          avoidCollisions={false}
          aria-labelledby={ariaLabelledBy}
        >
          body
        </FloatingPanel>
      </>
    );
  }

  it.each([
    ["renders without crashing when neither role nor accessible name is supplied", "unlabeled"],
    ["renders without crashing when role alone is supplied", "role"],
    ["renders without crashing when aria-labelledby alone is supplied", "labelledby"],
  ] as const)("%s", (_label, mode) => {
    if (mode === "unlabeled") {
      render(<UnlabeledHarness />);
    } else if (mode === "role") {
      render(<Harness initialOpen panelLabel="role-warn" panelRole="dialog" />);
    } else {
      render(<UnlabeledHarness ariaLabelledBy="external-name" />);
    }
  });
});

describe("FloatingPanel respects prefers-reduced-motion", () => {
  // jsdom does not evaluate @media in stylesheets and does not compile the
  // Tailwind `ui-floating-panel[data-state="open"]` rules from theme-base.css
  // into the CSSOM (those rules are compiled at build time, not parsed by
  // jsdom). So a true behavior assertion on `panel.animationName` is not
  // observable here. The fixture lifts the reduced-motion `:root` overrides
  // out of their @media wrapper to simulate the user preference; the
  // assertion reads the resolved variables that the production stylesheet
  // would read from the panel element.
  applyReducedMotionFixture();

  it("neutralizes every directional enter and exit motion when the panel is open", () => {
    render(<Harness initialOpen panelLabel="reduced" />);
    const panel = screen.getByRole("dialog", { name: "reduced" });
    const root = panel.ownerDocument.documentElement;
    const resolved = (name: string) => getComputedStyle(root).getPropertyValue(name).trim();

    expect(resolved("--ui-content-enter-from-top")).toMatch(/^ui-content-enter-fade\b/);
    expect(resolved("--ui-content-enter-from-bottom")).toMatch(/^ui-content-enter-fade\b/);
    expect(resolved("--ui-content-enter-from-left")).toMatch(/^ui-content-enter-fade\b/);
    expect(resolved("--ui-content-enter-from-right")).toMatch(/^ui-content-enter-fade\b/);
    expect(resolved("--ui-content-exit-to-top")).toMatch(/^ui-content-exit-fade\b/);
    expect(resolved("--ui-content-exit-to-bottom")).toMatch(/^ui-content-exit-fade\b/);
    expect(resolved("--ui-content-exit-to-left")).toMatch(/^ui-content-exit-fade\b/);
    expect(resolved("--ui-content-exit-to-right")).toMatch(/^ui-content-exit-fade\b/);
  });
});

describe("FloatingPanel a11y", () => {
  // baseElement (document.body by default) is scanned instead of container because
  // FloatingPanel portals into document.body — `container` would only see the trigger.
  // `region` is a page-level landmark rule that fires because the test harness
  // has no <main>/<nav>; component-level a11y is the contract here.
  const componentAxeRules = { region: { enabled: false } };

  it("has no axe violations with role=dialog and aria-label", async () => {
    const { baseElement } = render(
      <Harness initialOpen panelRole="dialog" panelLabel="dialog-a11y" />,
    );
    expect(await axe(baseElement, { rules: componentAxeRules })).toHaveNoViolations();
  });

  it("has no axe violations with role=menu, aria-label, and menuitem children", async () => {
    function MenuHarness() {
      const triggerRef = useRef<HTMLButtonElement | null>(null);
      return (
        <>
          <button
            type="button"
            ref={(node) => {
              triggerRef.current = node;
              mountTriggerRect(node, { x: 100, y: 100, width: 140, height: 32 });
            }}
          >
            toggle
          </button>
          <FloatingPanel
            open
            triggerRef={triggerRef}
            avoidCollisions={false}
            role="menu"
            aria-label="menu-a11y"
          >
            <button type="button" role="menuitem">
              First
            </button>
            <button type="button" role="menuitem">
              Second
            </button>
          </FloatingPanel>
        </>
      );
    }
    const { baseElement } = render(<MenuHarness />);
    expect(await axe(baseElement, { rules: componentAxeRules })).toHaveNoViolations();
  });
});

describe("FloatingPanel exit fallback timer", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("forces unmount once exitFallbackMs elapses without an animationend event", () => {
    vi.useFakeTimers();
    const onExitComplete = vi.fn();
    render(
      <Harness
        initialOpen
        panelLabel="fallback"
        exitFallbackMs={50}
        onExitComplete={onExitComplete}
      />,
    );
    expect(screen.getByRole("dialog", { name: "fallback" })).toBeInTheDocument();

    act(() => {
      screen.getByRole("button", { name: "toggle" }).click();
    });
    expect(screen.getByRole("dialog", { name: "fallback" })).toHaveAttribute(
      "data-state",
      "closed",
    );

    act(() => {
      vi.advanceTimersByTime(50);
    });

    expect(screen.queryByRole("dialog", { name: "fallback" })).not.toBeInTheDocument();
    expect(onExitComplete).toHaveBeenCalledTimes(1);
  });
});

describe("FloatingPanel collision handling", () => {
  it("flips to the opposite side when the preferred side overflows the viewport", () => {
    // Place trigger near the top edge so `side='top'` would push the panel above the viewport.
    render(
      <Harness
        initialOpen
        side="top"
        avoidCollisions
        panelLabel="collision"
        triggerX={100}
        triggerY={4}
        triggerWidth={120}
        triggerHeight={32}
      />,
    );
    const panel = screen.getByRole("dialog", { name: "collision" });
    expect(panel).toHaveAttribute("data-side", "bottom");
  });
});

describe("FloatingPanel alignOffset", () => {
  it("shifts the panel cross-axis by alignOffset when align=start on a vertical side", () => {
    render(
      <Harness
        initialOpen
        side="bottom"
        align="start"
        panelLabel="offset-none"
        triggerX={100}
        triggerY={100}
      />,
    );
    const baselineLeft = parseFloat(screen.getByRole("dialog", { name: "offset-none" }).style.left);

    render(
      <Harness
        initialOpen
        side="bottom"
        align="start"
        alignOffset={10}
        panelLabel="offset-ten"
        triggerX={100}
        triggerY={100}
      />,
    );
    const offsetLeft = parseFloat(screen.getByRole("dialog", { name: "offset-ten" }).style.left);

    expect(offsetLeft - baselineLeft).toBe(10);
  });
});

describe("FloatingPanel mount/remount cycle", () => {
  it("keeps panel mounted with data-state=closed during exit, unmounts on animationend, and remounts cleanly on re-open", async () => {
    render(<Harness initialOpen panelLabel="cycle" />);
    const initialPanel = await screen.findByRole("dialog", { name: "cycle" });
    expect(initialPanel).toHaveAttribute("data-state", "open");

    await act(async () => {
      screen.getByRole("button", { name: "toggle" }).click();
    });
    expect(initialPanel).toHaveAttribute("data-state", "closed");
    expect(initialPanel).toBeInTheDocument();

    await act(async () => {
      // fireEvent retained: animationEnd has no userEvent equivalent.
      fireEvent.animationEnd(initialPanel);
    });
    expect(screen.queryByRole("dialog", { name: "cycle" })).not.toBeInTheDocument();

    await act(async () => {
      screen.getByRole("button", { name: "toggle" }).click();
    });

    const reopenedPanel = await screen.findByRole("dialog", { name: "cycle" });
    expect(reopenedPanel).toHaveAttribute("data-state", "open");
    expect(reopenedPanel).toHaveAttribute("data-positioned", "");
    expect(reopenedPanel).toHaveAttribute("data-side", "bottom");
  });
});

describe("FloatingPanel cross-document portal", () => {
  it("renders into a target inside an iframe document when portalContainer points there", () => {
    const iframe = document.createElement("iframe");
    document.body.appendChild(iframe);
    const iframeDoc = iframe.contentDocument;
    if (!iframeDoc) {
      iframe.remove();
      throw new Error("iframe.contentDocument is null; cannot exercise cross-document portal");
    }

    const altRoot = iframeDoc.createElement("div");
    altRoot.id = "iframe-portal-root";
    iframeDoc.body.appendChild(altRoot);

    render(<Harness initialOpen portalContainer={altRoot} panelLabel="cross-doc" />);

    const panel = within(altRoot).getByRole("dialog", { name: "cross-doc" });
    expect(panel.ownerDocument).toBe(iframeDoc);

    iframe.remove();
  });
});
