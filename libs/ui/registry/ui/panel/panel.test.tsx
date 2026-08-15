import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { render, screen, within } from "@testing-library/react";
import { JSDOM } from "jsdom";
import { createRef, useEffect } from "react";
import { renderToString } from "react-dom/server";
import { assertType, describe, expect, it } from "vitest";
import { axe } from "../../../testing/axe";
import { ruleBody } from "../../testing/css-contract";
import { expectSingleReticle } from "../../testing/reticle";
import { Panel, type PanelProps } from "./index";

function getRoot(container: HTMLElement): HTMLElement {
  const root = container.querySelector('[data-slot="panel"]');
  if (!(root instanceof HTMLElement)) throw new Error("Panel root not found");
  return root;
}

/**
 * The inset utilities that place a floating label — `left-4`, `-top-3`,
 * `left-[calc(var(--viewfinder-size,12px)+10px)]`. "The label does not move" is a
 * claim about these tokens alone, so a focus- or frame-only colour utility must
 * not answer for it.
 */
function insetTokens(element: Element | null): string[] {
  return [...(element?.classList ?? [])].filter((token) =>
    /^-?(?:left|top|right|bottom)-/.test(token),
  );
}

function OpaquePanelHeading() {
  return (
    <Panel.Header>
      <Panel.Title id="opaque-panel-title">SSR release</Panel.Title>
      <Panel.Description id="opaque-panel-description">SSR description</Panel.Description>
    </Panel.Header>
  );
}

/** Counts mounts so a host-element swap (which tears the subtree down) is observable. */
function MountProbe({ mounts }: { mounts: { current: number } }) {
  useEffect(() => {
    mounts.current += 1;
  }, [mounts]);
  return <input aria-label="Draft note" defaultValue="typed" />;
}

describe("Panel", () => {
  it("renders as <div> by default when no title or aria-label is supplied", () => {
    const { container } = render(
      <Panel>
        <Panel.Content>Body</Panel.Content>
      </Panel>,
    );

    const root = getRoot(container);
    expect(root.tagName).toBe("DIV");
    expect(root).not.toHaveAttribute("aria-labelledby");
    expect(root).not.toHaveAttribute("aria-label");
  });

  it("renders as <section> with aria-labelledby when Panel.Title is present", () => {
    const { container } = render(
      <Panel>
        <Panel.Header>
          <Panel.Title>Release</Panel.Title>
        </Panel.Header>
      </Panel>,
    );

    const root = getRoot(container);
    expect(root.tagName).toBe("SECTION");
    const title = screen.getByRole("heading", { name: "Release" });
    expect(root).toHaveAttribute("aria-labelledby", title.id);
  });

  it("keeps a consumer-supplied id on Panel.Title and tracks it in aria-labelledby", () => {
    const { container } = render(
      <Panel>
        <Panel.Header>
          <Panel.Title id="custom-title">Release</Panel.Title>
        </Panel.Header>
      </Panel>,
    );

    const root = getRoot(container);
    const title = screen.getByRole("heading", { name: "Release" });
    expect(title).toHaveAttribute("id", "custom-title");
    expect(root).toHaveAttribute("aria-labelledby", "custom-title");
  });

  it("names the panel through a Panel.Title rendered inside a consumer wrapper", () => {
    function TitleWrapper({ children }: { children: React.ReactNode }) {
      return <div>{children}</div>;
    }
    const { container } = render(
      <Panel>
        <Panel.Header>
          <TitleWrapper>
            <Panel.Title>Wrapped</Panel.Title>
          </TitleWrapper>
        </Panel.Header>
      </Panel>,
    );

    const root = getRoot(container);
    expect(root.tagName).toBe("SECTION");
    const title = screen.getByRole("heading", { name: "Wrapped" });
    expect(root).toHaveAttribute("aria-labelledby", title.id);
    expect(screen.getByRole("region", { name: "Wrapped" })).toBe(root);
  });

  it("does not attribute a nested Panel's title to an outer Panel with no title of its own", () => {
    const { container } = render(
      <Panel>
        <Panel.Content>
          <Panel>
            <Panel.Header>
              <Panel.Title>Inner</Panel.Title>
            </Panel.Header>
          </Panel>
        </Panel.Content>
      </Panel>,
    );

    const roots = container.querySelectorAll('[data-slot="panel"]');
    const outer = roots[0];
    const inner = roots[1];
    if (!(outer instanceof HTMLElement) || !(inner instanceof HTMLElement)) {
      throw new Error("Expected two panel roots");
    }

    expect(outer.tagName).toBe("DIV");
    expect(outer).not.toHaveAttribute("aria-labelledby");
    expect(outer).not.toHaveAttribute("aria-label");

    const title = screen.getByRole("heading", { name: "Inner" });
    expect(inner.tagName).toBe("SECTION");
    expect(inner).toHaveAttribute("aria-labelledby", title.id);
    expect(screen.getByRole("region", { name: "Inner" })).toBe(inner);
  });

  it("renders as <section> when aria-label is provided", () => {
    const { container } = render(
      <Panel aria-label="Release">
        <Panel.Content>Body</Panel.Content>
      </Panel>,
    );

    const root = getRoot(container);
    expect(root.tagName).toBe("SECTION");
    expect(root).toHaveAttribute("aria-label", "Release");
  });

  it("auto-wires aria-describedby when Panel.Description is present", () => {
    const { container } = render(
      <Panel>
        <Panel.Header>
          <Panel.Title>Release</Panel.Title>
          <Panel.Description>0.1.0</Panel.Description>
        </Panel.Header>
      </Panel>,
    );

    const root = getRoot(container);
    const description = container.querySelector('[data-slot="panel-description"]');
    expect(description).not.toBeNull();
    expect(root).toHaveAttribute("aria-describedby", description?.id);
  });

  it("merges a caller aria-describedby with the Panel.Description id", () => {
    const { container } = render(
      <Panel aria-describedby="external-hint">
        <Panel.Header>
          <Panel.Title>Release</Panel.Title>
          <Panel.Description>0.1.0</Panel.Description>
        </Panel.Header>
      </Panel>,
    );

    const root = getRoot(container);
    const description = container.querySelector('[data-slot="panel-description"]');
    expect(description?.id).toBeTruthy();
    expect(root).toHaveAttribute("aria-describedby", `external-hint ${description?.id}`);
  });

  it("preserves a caller aria-describedby when no Panel.Description is present", () => {
    const { container } = render(
      <Panel aria-describedby="external-hint">
        <Panel.Content>Body</Panel.Content>
      </Panel>,
    );

    const root = getRoot(container);
    expect(root).toHaveAttribute("aria-describedby", "external-hint");
  });

  it("polymorphic-ref type narrows by the `as` value (compile-time)", () => {
    const divProps: PanelProps<"div"> = {
      as: "div",
      ref: createRef<HTMLDivElement>(),
      "aria-label": "x",
    };
    const asideProps: PanelProps<"aside"> = {
      as: "aside",
      ref: createRef<HTMLElement>(),
      "aria-label": "x",
    };
    assertType<PanelProps<"div">>(divProps);
    assertType<PanelProps<"aside">>(asideProps);

    const defaultProps: PanelProps = { ref: createRef<HTMLDivElement>() };
    assertType<PanelProps>(defaultProps);
  });

  it("forwards refs through the polymorphic `as` prop", () => {
    const articleRef = createRef<HTMLElement>();
    const sectionRef = createRef<HTMLElement>();
    const asideRef = createRef<HTMLElement>();

    const { rerender } = render(
      <Panel as="article" ref={articleRef} aria-label="A">
        x
      </Panel>,
    );
    expect(articleRef.current?.tagName).toBe("ARTICLE");

    rerender(
      <Panel as="section" ref={sectionRef} aria-label="S">
        x
      </Panel>,
    );
    expect(sectionRef.current?.tagName).toBe("SECTION");

    rerender(
      <Panel as="aside" ref={asideRef} aria-label="A">
        x
      </Panel>,
    );
    expect(asideRef.current?.tagName).toBe("ASIDE");
  });

  it("sets data-frame, data-tone, and data-density on the root", () => {
    const { container } = render(
      <Panel frame="rail" tone="warning" density="compact">
        <Panel.Content>Body</Panel.Content>
      </Panel>,
    );

    const root = getRoot(container);
    expect(root).toHaveAttribute("data-frame", "rail");
    expect(root).toHaveAttribute("data-tone", "warning");
    expect(root).toHaveAttribute("data-density", "compact");
  });

  it("uses default data-frame=hairline and data-density=default", () => {
    const { container } = render(
      <Panel>
        <Panel.Content>Body</Panel.Content>
      </Panel>,
    );

    const root = getRoot(container);
    expect(root).toHaveAttribute("data-frame", "hairline");
    expect(root).toHaveAttribute("data-density", "default");
    expect(root).not.toHaveAttribute("data-tone");
  });

  it("Panel.Title renders the heading level supplied via `as`", () => {
    render(
      <Panel>
        <Panel.Header>
          <Panel.Title as="h3">Release</Panel.Title>
        </Panel.Header>
      </Panel>,
    );

    const heading = screen.getByRole("heading", { name: "Release", level: 3 });
    expect(heading.tagName).toBe("H3");
  });

  it("Panel.Title defaults to <h2>", () => {
    render(
      <Panel>
        <Panel.Header>
          <Panel.Title>Release</Panel.Title>
        </Panel.Header>
      </Panel>,
    );

    const heading = screen.getByRole("heading", { name: "Release", level: 2 });
    expect(heading.tagName).toBe("H2");
  });

  it("Panel.Header defaults marker=bar", () => {
    const { container } = render(
      <Panel>
        <Panel.Header>
          <Panel.Title>Release</Panel.Title>
        </Panel.Header>
      </Panel>,
    );

    const header = container.querySelector('[data-slot="panel-header"]');
    expect(header).toHaveAttribute("data-marker", "bar");
  });

  it("Panel.Header marker=none suppresses the marker attribute", () => {
    const { container } = render(
      <Panel>
        <Panel.Header marker="none">
          <Panel.Title>Release</Panel.Title>
        </Panel.Header>
      </Panel>,
    );

    const header = container.querySelector('[data-slot="panel-header"]');
    expect(header).toHaveAttribute("data-marker", "none");
  });

  it("Panel.Row renders label and value", () => {
    render(
      <Panel>
        <Panel.Content>
          <Panel.Row label="Branch" value="main" />
        </Panel.Content>
      </Panel>,
    );

    expect(screen.getByText("Branch")).toBeInTheDocument();
    expect(screen.getByText("main")).toBeInTheDocument();
  });

  it("Adjacent Panel.Row siblings render with their data-slots intact", () => {
    const { container } = render(
      <Panel>
        <Panel.Content>
          <Panel.Row label="Branch" value="main" />
          <Panel.Row label="Commit" value="a1b2c3d" />
          <Panel.Row label="Author" value="dev@example.com" />
        </Panel.Content>
      </Panel>,
    );

    const rows = container.querySelectorAll('[data-slot="panel-row"]');
    expect(rows).toHaveLength(3);
  });

  it("Panel.Header places non-Title/Description siblings in the right slot", () => {
    const { container } = render(
      <Panel>
        <Panel.Header>
          <Panel.Title>Release</Panel.Title>
          <Panel.Description>v1</Panel.Description>
          <span>MAIN</span>
          <button type="button">Open</button>
        </Panel.Header>
      </Panel>,
    );

    const body = container.querySelector('[data-slot="panel-header-body"]');
    const end = container.querySelector('[data-slot="panel-header-end"]');

    expect(body?.querySelector('[data-slot="panel-title"]')).not.toBeNull();
    expect(body?.querySelector('[data-slot="panel-description"]')).not.toBeNull();
    expect(end).toHaveTextContent("MAIN");
    expect(end?.querySelector("button")).not.toBeNull();
  });

  it("renders viewfinder corner brackets when frame=viewfinder", () => {
    const { container } = render(
      <Panel frame="viewfinder">
        <Panel.Content>Body</Panel.Content>
      </Panel>,
    );

    const corners = container.querySelector('[data-slot="panel-corners"]');
    expect(corners).not.toBeNull();
    expect(corners?.querySelectorAll("span")).toHaveLength(4);
  });

  it("does not render viewfinder corner brackets for other frames", () => {
    const { container } = render(
      <Panel frame="hairline">
        <Panel.Content>Body</Panel.Content>
      </Panel>,
    );

    expect(container.querySelector('[data-slot="panel-corners"]')).toBeNull();
    expect(getRoot(container)).not.toHaveAttribute("data-state");
  });

  it("focused draws corner brackets on a frame that has none at rest", () => {
    const { container } = render(
      <Panel focused>
        <Panel.Content>Body</Panel.Content>
      </Panel>,
    );

    const root = getRoot(container);
    expect(root).toHaveAttribute("data-state", "focused");
    expect(root).toHaveAttribute("data-frame", "hairline");

    const corners = container.querySelector('[data-slot="panel-corners"]');
    expect(corners).toHaveAttribute("aria-hidden", "true");
    expect(corners?.querySelectorAll("span")).toHaveLength(4);
  });

  it("focused keeps the viewfinder frame's corners and marks the pane state", () => {
    const { container } = render(
      <Panel frame="viewfinder" focused>
        <Panel.Content>Body</Panel.Content>
      </Panel>,
    );

    const root = getRoot(container);
    expect(root).toHaveAttribute("data-state", "focused");
    expect(root).toHaveAttribute("data-frame", "viewfinder");
    expect(container.querySelectorAll('[data-slot="panel-corners"] > span')).toHaveLength(4);
  });

  it("focused leaves the accessible region name, description, and element untouched", async () => {
    const tree = (focused: boolean) => (
      <Panel focused={focused}>
        <Panel.Header>
          <Panel.Title>Release</Panel.Title>
          <Panel.Description>v1</Panel.Description>
        </Panel.Header>
        <Panel.Content>Body</Panel.Content>
      </Panel>
    );

    const { container, rerender } = render(tree(false));
    const resting = screen.getByRole("region", { name: "Release" });
    expect(resting).toHaveAccessibleDescription("v1");

    rerender(tree(true));
    const focused = screen.getByRole("region", { name: "Release" });
    expect(focused).toBe(resting);
    expect(focused.tagName).toBe("SECTION");
    expect(focused).toHaveAccessibleDescription("v1");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no a11y violations for the default panel", async () => {
    const { container } = render(
      <Panel>
        <Panel.Header>
          <Panel.Title>Release</Panel.Title>
          <Panel.Description>v1</Panel.Description>
        </Panel.Header>
        <Panel.Content>
          <Panel.Row label="Branch" value="main" />
        </Panel.Content>
      </Panel>,
    );

    expect(await axe(container)).toHaveNoViolations();
  });

  it("renders Panel.Label content", () => {
    const { container } = render(
      <Panel frame="hairline">
        <Panel.Label>[ 01 / FS_TREE ]</Panel.Label>
        <Panel.Content>Body</Panel.Content>
      </Panel>,
    );

    const label = container.querySelector('[data-slot="panel-label"]');
    expect(label).not.toBeNull();
    expect(label).toHaveTextContent("[ 01 / FS_TREE ]");
  });

  // jsdom applies no stylesheet, so "the label does not move" is asserted as the
  // label keeping the same inset utilities: one inset now clears a bracket arm in
  // every state, and nothing is left to switch on focus.
  it("keeps Panel.Label in one place whether or not the panel draws brackets", () => {
    function LabelledPanel({ focused }: { focused?: boolean }) {
      return (
        <Panel frame="hairline" focused={focused}>
          <Panel.Label>Progress</Panel.Label>
        </Panel>
      );
    }

    const { container, rerender } = render(<LabelledPanel />);
    const label = () => container.querySelector('[data-slot="panel-label"]');
    const resting = insetTokens(label());
    expect(resting.length).toBeGreaterThan(0);

    rerender(<LabelledPanel focused />);
    expect(insetTokens(label())).toEqual(resting);

    const { container: viewfinder } = render(
      <Panel frame="viewfinder">
        <Panel.Label>Details</Panel.Label>
      </Panel>,
    );
    expect(insetTokens(viewfinder.querySelector('[data-slot="panel-label"]'))).toEqual(resting);
  });

  it("Panel.Label publishes its variant and defaults to the boxed border label", () => {
    const { container } = render(
      <Panel>
        <Panel.Label>Boxed</Panel.Label>
        <Panel.Label variant="readout">SETUP · 02/06 · PROVIDER</Panel.Label>
      </Panel>,
    );

    const labels = container.querySelectorAll('[data-slot="panel-label"]');
    expect(labels[0]).toHaveAttribute("data-variant", "border");
    expect(labels[1]).toHaveAttribute("data-variant", "readout");
  });

  it("Panel.Label readout tracks the pane state, and other variants do not carry a box", () => {
    function ReadoutPanel({ focused }: { focused?: boolean }) {
      return (
        <Panel frame="viewfinder" focused={focused}>
          <Panel.Label variant="readout">SETUP · 02/06 · PROVIDER</Panel.Label>
        </Panel>
      );
    }

    const { container, rerender } = render(<ReadoutPanel />);
    const label = () => container.querySelector('[data-slot="panel-label"]');

    expect(label()).not.toHaveAttribute("data-state");
    // The bracket arms are the readout's frame; a border box would double it.
    expect(label()).not.toHaveClass("border");

    rerender(<ReadoutPanel focused />);
    expect(label()).toHaveAttribute("data-state", "focused");
  });

  it("Panel.Label readout holds one inline-start inset on a frame that draws no brackets", () => {
    function ReadoutPanel({ focused }: { focused?: boolean }) {
      return (
        <Panel frame="hairline" focused={focused}>
          <Panel.Label variant="readout">SETUP · 02/06 · PROVIDER</Panel.Label>
        </Panel>
      );
    }

    const { container, rerender } = render(<ReadoutPanel />);
    const startInset = () =>
      insetTokens(container.querySelector('[data-slot="panel-label"]')).filter((token) =>
        token.startsWith("left-"),
      );

    const resting = startInset();
    // A hairline pane declares no --viewfinder-size until focus draws its arms, so
    // the fallback is the mechanism under test: without one the whole declaration
    // is invalid at rest and the readout drops onto the panel corner, then slides
    // once focus arrives. What the arm length is tuned to stays a design decision
    // panel.css owns, so assert that a fallback exists rather than its value.
    expect(resting).toHaveLength(1);
    expect(resting[0]).toMatch(/var\(--viewfinder-size,[^)]+\)/);

    rerender(<ReadoutPanel focused />);
    expect(startInset()).toEqual(resting);
  });

  it("Panel.Label readout keeps its text in the accessibility tree", () => {
    render(
      <Panel frame="viewfinder" focused>
        <Panel.Label variant="readout">SETUP · 02/06 · PROVIDER</Panel.Label>
        <Panel.Content>Body</Panel.Content>
      </Panel>,
    );

    expect(screen.getByText("SETUP · 02/06 · PROVIDER")).toBeInTheDocument();
  });

  it("names and describes the server-rendered section by Panel.Title/Panel.Description", () => {
    const html = renderToString(
      <Panel>
        <Panel.Header>
          <Panel.Title>SSR release</Panel.Title>
          <Panel.Description>SSR description</Panel.Description>
        </Panel.Header>
      </Panel>,
    );

    const { window: ssrWindow } = new JSDOM(`<!doctype html><body>${html}</body>`);
    const region = within(ssrWindow.document.body).getByRole("region", { name: "SSR release" });
    expect(region).toHaveAccessibleDescription("SSR description");
  });

  it("wires the same title/description idrefs on SSR and after client render", () => {
    const tree = (
      <Panel>
        <Panel.Header>
          <Panel.Title id="stable-title">Stable</Panel.Title>
          <Panel.Description id="stable-description">Stable body</Panel.Description>
        </Panel.Header>
      </Panel>
    );

    const html = renderToString(tree);
    expect(html).toContain('aria-labelledby="stable-title"');
    expect(html).toContain('aria-describedby="stable-description"');

    const { container } = render(tree);
    const root = getRoot(container);
    expect(root).toHaveAttribute("aria-labelledby", "stable-title");
    expect(root).toHaveAttribute("aria-describedby", "stable-description");
  });

  it("wires an opaque wrapper on SSR through explicit stable ids", () => {
    const html = renderToString(
      <Panel aria-labelledby="opaque-panel-title" aria-describedby="opaque-panel-description">
        <OpaquePanelHeading />
      </Panel>,
    );

    expect(html).toContain("<section");
    expect(html).toContain('aria-labelledby="opaque-panel-title"');
    expect(html).toContain('aria-describedby="opaque-panel-description"');
    expect(html).toContain('id="opaque-panel-title"');
    expect(html).toContain('id="opaque-panel-description"');
  });

  it("keeps the host element and subtree intact when an opaque wrapper registers the title", () => {
    const mounts = { current: 0 };

    const { container } = render(
      <Panel>
        <OpaquePanelHeading />
        <Panel.Content>
          <MountProbe mounts={mounts} />
        </Panel.Content>
      </Panel>,
    );

    expect(mounts.current).toBe(1);

    const root = getRoot(container);
    expect(root.tagName).toBe("DIV");
    expect(root).toHaveAttribute("aria-labelledby", "opaque-panel-title");
    expect(root).toHaveAttribute("aria-describedby", "opaque-panel-description");
  });
});

describe("Panel reticle grammar", () => {
  // jsdom applies no stylesheet and drops @layer rules from its CSSOM, so the
  // corner tokens are only readable from the source panel.css ships.
  const css = readFileSync(resolve(fileURLToPath(import.meta.url), "../panel.css"), "utf8");
  const RESTING = '[data-slot="panel"][data-frame="viewfinder"]';
  const FOCUSED = '[data-slot="panel"][data-frame][data-state="focused"]';
  const FOCUSED_PERIMETER =
    '[data-slot="panel"][data-frame="hairline"][data-state="focused"], [data-slot="panel"][data-frame="surface"][data-state="focused"]';

  it("draws one bracket geometry in both states so color alone encodes focus", () => {
    const resting = ruleBody(css, RESTING);
    const focused = ruleBody(css, FOCUSED);

    expect(resting).toContain("--viewfinder-size: 12px");
    expect(resting).toContain("--viewfinder-weight: 1px");
    expect(resting).toContain("--viewfinder-color: var(--foreground)");
    // -1px seats the 1px arm exactly over the panel's 1px border line.
    expect(resting).toContain("--viewfinder-offset: -1px");

    expect(focused).toContain("--viewfinder-size: 12px");
    expect(focused).toContain("--viewfinder-weight: 1px");
    expect(focused).toContain("--viewfinder-color: var(--ring)");
    expect(focused).toContain("--viewfinder-offset: -1px");
  });

  it("firms the framed perimeter to --border-strong with the brackets", () => {
    expect(ruleBody(css, FOCUSED_PERIMETER)).toContain(
      "--panel-border-color: var(--border-strong)",
    );

    for (const frame of ["hairline", "surface"]) {
      const body = ruleBody(css, `[data-slot="panel"][data-frame="${frame}"]`);
      // The perimeter reads the internal the focused rule repoints, and that
      // internal defaults through --panel-border so an app can lift the
      // enclosure without touching the dimmer header/footer/row hairlines.
      expect(body).toContain("border: 1px solid var(--panel-border-color)");
      expect(body).toContain("--panel-border-color: var(");
      expect(body).toContain("--panel-border,");
    }
  });

  it("declares the focused corner rule after the tone rules so focus wins on equal specificity", () => {
    expect(css.indexOf(`${FOCUSED} {`)).toBeGreaterThan(
      css.indexOf(`${RESTING}[data-tone="accent"] {`),
    );
  });

  it("holds the viewfinder padding steady so a focus toggle never reflows the box", () => {
    expect(ruleBody(css, RESTING)).toContain("padding: 8px");
    expect(ruleBody(css, FOCUSED)).not.toContain("padding");
  });

  it("counts exactly one focused pane per screen", () => {
    const { container } = render(
      <div>
        <Panel frame="viewfinder" aria-label="Context">
          <Panel.Content>Inert</Panel.Content>
        </Panel>
        <Panel focused aria-label="Menu">
          <Panel.Content>Driven</Panel.Content>
        </Panel>
      </div>,
    );

    expectSingleReticle(container);
  });

  it("fails a screen that lights a second reticle", () => {
    const { container } = render(
      <div>
        <Panel focused aria-label="Menu">
          <Panel.Content>Driven</Panel.Content>
        </Panel>
        <Panel focused aria-label="Context">
          <Panel.Content>Also driven</Panel.Content>
        </Panel>
      </div>,
    );

    expect(() => expectSingleReticle(container)).toThrow();
  });
});
