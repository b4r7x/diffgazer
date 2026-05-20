import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, assertType, describe, expect, it, vi } from "vitest";
import { axe } from "../../../testing/utils.js";
import { Panel, type PanelProps } from "./index.js";

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
    expect(root).toHaveAttribute("aria-describedby", description!.id);
  });

  it("polymorphic-ref type narrows by the `as` value (compile-time)", () => {
    // PanelProps<T> is a single generic, not a 4-branch union. This means
    // PanelProps<"div"> has a div-specific ref (HTMLDivElement) and accepts
    // div-specific props, while PanelProps<"aside"> uses the HTMLElement
    // base. The old union shape erased polymorphic-ref correlation; the
    // new shape preserves it. The assertions below must type-check.
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

    // Default generic is "div" — explicit-vs-default must agree on shape.
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
          <span data-testid="eyebrow">MAIN</span>
          <button type="button">Open</button>
        </Panel.Header>
      </Panel>,
    );

    const body = container.querySelector('[data-slot="panel-header-body"]');
    const end = container.querySelector('[data-slot="panel-header-end"]');

    expect(body?.querySelector('[data-slot="panel-title"]')).not.toBeNull();
    expect(body?.querySelector('[data-slot="panel-description"]')).not.toBeNull();
    expect(end?.querySelector('[data-testid="eyebrow"]')).not.toBeNull();
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

  it.each(["hairline", "rail", "viewfinder", "surface"] as const)(
    "has no a11y violations for frame=%s",
    async (frame) => {
      const { container } = render(
        <Panel frame={frame}>
          <Panel.Header>
            <Panel.Title>Release</Panel.Title>
          </Panel.Header>
          <Panel.Content>Body</Panel.Content>
        </Panel>,
      );

      expect(await axe(container)).toHaveNoViolations();
    },
  );

  it.each(["info", "success", "warning", "error", "accent"] as const)(
    "has no a11y violations for tone=%s",
    async (tone) => {
      const { container } = render(
        <Panel tone={tone}>
          <Panel.Header>
            <Panel.Title>Release</Panel.Title>
          </Panel.Header>
          <Panel.Content>Body</Panel.Content>
        </Panel>,
      );

      expect(await axe(container)).toHaveNoViolations();
    },
  );

  describe("dev-warn on duplicate Panel.Title / Panel.Description", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("warns when two <Panel.Title> children are rendered", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      render(
        <Panel>
          <Panel.Header>
            <Panel.Title>First</Panel.Title>
            <Panel.Title>Second</Panel.Title>
          </Panel.Header>
        </Panel>,
      );

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Multiple <Panel.Title>"),
      );
    });

    it("warns when two <Panel.Description> children are rendered", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      render(
        <Panel>
          <Panel.Header>
            <Panel.Title>Release</Panel.Title>
            <Panel.Description>First</Panel.Description>
            <Panel.Description>Second</Panel.Description>
          </Panel.Header>
        </Panel>,
      );

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Multiple <Panel.Description>"),
      );
    });

    it("does not warn for one of each", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      render(
        <Panel>
          <Panel.Header>
            <Panel.Title>Release</Panel.Title>
            <Panel.Description>v1</Panel.Description>
          </Panel.Header>
        </Panel>,
      );

      expect(warnSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("[Panel]"),
      );
    });
  });

  it("has no a11y violations across the full frame × tone matrix", async () => {
    const frames = ["hairline", "rail", "viewfinder", "surface"] as const;
    const tones = ["info", "success", "warning", "error", "accent"] as const;

    for (const frame of frames) {
      for (const tone of tones) {
        const { container, unmount } = render(
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
        unmount();
      }
    }
  });
});
