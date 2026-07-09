import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { renderToString } from "react-dom/server";
import { assertType, describe, expect, it } from "vitest";
import { axe } from "../../../testing/axe";
import { Panel, type PanelProps } from "./index";

function getRoot(container: HTMLElement): HTMLElement {
  const root = container.querySelector('[data-slot="panel"]');
  if (!(root instanceof HTMLElement)) throw new Error("Panel root not found");
  return root;
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

    expect(divProps.as).toBe("div");
    expect(asideProps.as).toBe("aside");
    expect(defaultProps.as).toBeUndefined();
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

  it.each([
    "hairline",
    "rail",
    "viewfinder",
    "surface",
  ] as const)("has no a11y violations for frame=%s", async (frame) => {
    const { container } = render(
      <Panel frame={frame}>
        <Panel.Header>
          <Panel.Title>Release</Panel.Title>
        </Panel.Header>
        <Panel.Content>Body</Panel.Content>
      </Panel>,
    );

    expect(await axe(container)).toHaveNoViolations();
  });

  it.each([
    "info",
    "success",
    "warning",
    "error",
    "accent",
  ] as const)("has no a11y violations for tone=%s", async (tone) => {
    const { container } = render(
      <Panel tone={tone}>
        <Panel.Header>
          <Panel.Title>Release</Panel.Title>
        </Panel.Header>
        <Panel.Content>Body</Panel.Content>
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

  it.each(
    (["hairline", "rail", "viewfinder", "surface"] as const).flatMap((frame) =>
      (["info", "success", "warning", "error", "accent"] as const).map(
        (tone) => [frame, tone] as const,
      ),
    ),
  )("has no a11y violations for frame=%s tone=%s", async (frame, tone) => {
    const { container } = render(
      <Panel frame={frame} tone={tone}>
        <Panel.Header>
          <Panel.Title>
            {frame} / {tone}
          </Panel.Title>
          <Panel.Description>matrix combination</Panel.Description>
        </Panel.Header>
        <Panel.Content>
          <Panel.Row label="Frame" value={frame} />
          <Panel.Row label="Tone" value={tone} />
        </Panel.Content>
        <Panel.Footer>Footer</Panel.Footer>
      </Panel>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("emits <section> and aria-labelledby on the SSR string when Panel.Title is present", () => {
    const html = renderToString(
      <Panel>
        <Panel.Header>
          <Panel.Title>SSR release</Panel.Title>
        </Panel.Header>
      </Panel>,
    );

    expect(html).toContain("<section");
    expect(html).toContain("aria-labelledby=");
    expect(html).toContain("SSR release");
  });

  it("emits aria-describedby on the SSR string when Panel.Description is present", () => {
    const html = renderToString(
      <Panel>
        <Panel.Header>
          <Panel.Title>SSR release</Panel.Title>
          <Panel.Description>SSR description</Panel.Description>
        </Panel.Header>
      </Panel>,
    );

    expect(html).toContain("aria-describedby=");
    expect(html).toContain("SSR description");
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
});
