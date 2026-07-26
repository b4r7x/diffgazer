import { stubMatchMedia } from "@diffgazer/core/testing/match-media";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TableOfContents } from "fumadocs-core/toc";
import { describe, expect, it, vi } from "vitest";
import { SectionHeading } from "./docs-mdx/section-heading";
import { MobileTocPanel, TableOfContentsPanel, useDocsToc } from "./toc";

// Mirrors DocsPageLayout: the TOC is resolved once and handed to whichever
// panel the width calls for.
function SidebarToc({ toc }: { toc: TableOfContents }) {
  const { entries, activeId, scrollTo } = useDocsToc(toc);
  return <TableOfContentsPanel entries={entries} activeId={activeId} scrollTo={scrollTo} />;
}

function MobileToc({ toc }: { toc: TableOfContents }) {
  const { entries, scrollTo } = useDocsToc(toc);
  return <MobileTocPanel entries={entries} scrollTo={scrollTo} />;
}

function renderWithHeadings(
  headings: Array<{ tag: "h2" | "h3"; id?: string; text: string }>,
  toc: TableOfContents = [],
) {
  return render(
    <main id="main-content">
      {headings.map(({ tag: Tag, id, text }) => (
        <Tag key={text} id={id}>
          {text}
        </Tag>
      ))}
      <SidebarToc toc={toc} />
    </main>,
  );
}

function tocLinks() {
  const nav = screen.queryByRole("navigation", { name: /on this page/i });
  if (!nav) return [];
  return within(nav)
    .getAllByRole("link")
    .map((link) => link.textContent?.trim());
}

describe("TableOfContentsPanel", () => {
  it("builds entries from rendered headings even when the static TOC is empty", async () => {
    renderWithHeadings([
      { tag: "h2", id: "installation", text: "Installation" },
      { tag: "h2", id: "tailwind-setup", text: "Tailwind Setup" },
    ]);

    await waitFor(() => expect(tocLinks()).toEqual(["Installation", "Tailwind Setup"]));
  });

  it("includes runtime headings (Step titles) the compile-time TOC misses", async () => {
    renderWithHeadings(
      [
        { tag: "h2", id: "setup", text: "Setup" },
        {
          tag: "h2",
          id: "configure-a-source-alias",
          text: "Configure a source alias",
        },
        { tag: "h2", id: "result", text: "Result" },
      ],
      [{ title: "Setup", url: "#setup", depth: 2 }],
    );

    await waitFor(() =>
      expect(tocLinks()).toEqual(["Setup", "Configure a source alias", "Result"]),
    );
  });

  it("ignores headings without an id, including its own panel title", async () => {
    renderWithHeadings([
      { tag: "h2", id: "with-id", text: "With Id" },
      { tag: "h2", text: "No Id Heading" },
    ]);

    await waitFor(() => expect(tocLinks()).toEqual(["With Id"]));
  });

  it("leaves demo headings out of the page TOC and its scroll spy", async () => {
    render(
      <main id="main-content">
        <h2 id="usage">Usage</h2>
        <div data-demo-preview>
          <h2 id="demo-introduction">Introduction</h2>
          <h3 id="demo-installation">Installation</h3>
        </div>
        <h2 id="api">API</h2>
        <SidebarToc toc={[]} />
      </main>,
    );

    await waitFor(() => expect(tocLinks()).toEqual(["Usage", "API"]));
  });

  it("excludes a demo nested inside a real section", async () => {
    render(
      <main id="main-content">
        <h2 id="examples">Examples</h2>
        <section>
          <div data-demo-preview>
            <div>
              <h3 id="demo-section">Demo section</h3>
            </div>
          </div>
        </section>
        <SidebarToc toc={[]} />
      </main>,
    );

    await waitFor(() => expect(tocLinks()).toEqual(["Examples"]));
  });

  it("links each entry to its heading anchor", async () => {
    renderWithHeadings([{ tag: "h2", id: "examples", text: "Examples" }]);

    const link = await screen.findByRole("link", { name: "Examples" });
    expect(link).toHaveAttribute("href", "#examples");
  });

  it("refreshes the TOC when a heading is appended after mount", async () => {
    renderWithHeadings([{ tag: "h2", id: "intro", text: "Intro" }]);

    await waitFor(() => expect(tocLinks()).toEqual(["Intro"]));

    const container = document.getElementById("main-content");
    if (!container) throw new Error("missing #main-content container");
    const heading = document.createElement("h2");
    heading.id = "appended";
    heading.textContent = "Appended";
    container.appendChild(heading);

    await waitFor(() => expect(tocLinks()).toEqual(["Intro", "Appended"]));

    const link = screen.getByRole("link", { name: "Appended" });
    expect(link).toHaveAttribute("href", "#appended");
  });

  it("updates the TOC label when a heading's text changes after mount", async () => {
    renderWithHeadings([{ tag: "h2", id: "intro", text: "Intro" }]);

    await waitFor(() => expect(tocLinks()).toEqual(["Intro"]));

    const heading = document.getElementById("intro");
    const textNode = heading?.firstChild;
    if (!(textNode instanceof Text)) throw new Error("missing #intro text node");
    textNode.data = "Introduction";

    await waitFor(() => expect(tocLinks()).toEqual(["Introduction"]));
  });

  it("updates the TOC href when a heading's id changes after mount", async () => {
    renderWithHeadings([{ tag: "h2", id: "intro", text: "Intro" }]);

    const link = await screen.findByRole("link", { name: "Intro" });
    expect(link).toHaveAttribute("href", "#intro");

    const heading = document.getElementById("intro");
    if (!heading) throw new Error("missing #intro heading");
    heading.id = "introduction";

    await waitFor(() =>
      expect(screen.getByRole("link", { name: "Intro" })).toHaveAttribute("href", "#introduction"),
    );
  });

  it("refreshes the TOC when a heading is removed after mount", async () => {
    renderWithHeadings([
      { tag: "h2", id: "kept", text: "Kept" },
      { tag: "h2", id: "temporary", text: "Temporary" },
    ]);

    await waitFor(() => expect(tocLinks()).toEqual(["Kept", "Temporary"]));

    const removed = document.getElementById("temporary");
    if (!removed) throw new Error("missing #temporary heading");
    removed.remove();

    await waitFor(() => expect(tocLinks()).toEqual(["Kept"]));
    expect(tocLinks()).not.toContain("Temporary");
  });

  it("includes h3 headings nested deeper than their h2 siblings", async () => {
    renderWithHeadings([
      { tag: "h2", id: "overview", text: "Overview" },
      { tag: "h3", id: "details", text: "Details" },
    ]);

    await waitFor(() => expect(tocLinks()).toEqual(["Overview", "Details"]));

    const overview = screen.getByRole("link", { name: "Overview" });
    const details = screen.getByRole("link", { name: "Details" });

    // Depth is surfaced to the reader as left indentation: an h3 entry sits
    // deeper than its h2 sibling.
    const overviewIndent = Number.parseInt(overview.style.paddingLeft, 10);
    const detailsIndent = Number.parseInt(details.style.paddingLeft, 10);
    expect(detailsIndent).toBeGreaterThan(overviewIndent);
  });

  it("labels a SectionHeading entry without its decorative prompt marker", async () => {
    render(
      <main id="main-content">
        <SectionHeading id="api-reference">API Reference</SectionHeading>
        <SidebarToc toc={[]} />
      </main>,
    );

    await waitFor(() => expect(tocLinks()).toEqual(["API Reference"]));
  });

  it("produces a single TOC link when two headings share one id", async () => {
    renderWithHeadings([
      { tag: "h2", id: "duplicate", text: "First" },
      { tag: "h2", id: "duplicate", text: "Second" },
    ]);

    await waitFor(() =>
      expect(
        within(screen.getByRole("navigation", { name: /on this page/i })).getAllByRole("link"),
      ).toHaveLength(1),
    );

    const links = within(screen.getByRole("navigation", { name: /on this page/i })).getAllByRole(
      "link",
    );
    expect(links[0]).toHaveAttribute("href", "#duplicate");
  });

  it.each([
    { reducedMotion: true, behavior: "auto" },
    { reducedMotion: false, behavior: "smooth" },
  ] as const)("uses $behavior scrolling for main content and an overflowed sidebar", async ({
    reducedMotion,
    behavior,
  }) => {
    const user = userEvent.setup();
    stubMatchMedia((query) => reducedMotion && query === "(prefers-reduced-motion: reduce)");

    renderWithHeadings([
      { tag: "h2", id: "overview", text: "Overview" },
      { tag: "h2", id: "details", text: "Details" },
    ]);

    const overview = await screen.findByRole("link", { name: "Overview" });
    const details = screen.getByRole("link", { name: "Details" });
    await waitFor(() => expect(details).toHaveAttribute("aria-current", "location"));

    const overviewHeading = document.getElementById("overview");
    const detailsHeading = document.getElementById("details");
    const mainContent = document.getElementById("main-content");
    const scrollArea = overview.closest('[data-slot="scroll-area"]');
    if (
      !(overviewHeading instanceof HTMLElement) ||
      !(detailsHeading instanceof HTMLElement) ||
      !(mainContent instanceof HTMLElement) ||
      !(scrollArea instanceof HTMLElement)
    ) {
      throw new Error("Expected headings and scroll areas");
    }

    overviewHeading.getBoundingClientRect = () => new DOMRect(0, 50, 100, 20);
    detailsHeading.getBoundingClientRect = () => new DOMRect(0, 500, 100, 20);
    mainContent.getBoundingClientRect = () => new DOMRect(0, 0, 100, 500);
    Object.defineProperties(mainContent, {
      clientHeight: { configurable: true, value: 500 },
      scrollHeight: { configurable: true, value: 1000 },
      scrollTop: { configurable: true, value: 0, writable: true },
    });
    const mainScroll = vi.fn();
    Object.defineProperty(mainContent, "scrollTo", {
      configurable: true,
      value: mainScroll,
    });
    scrollArea.style.overflowY = "auto";
    Object.defineProperties(scrollArea, {
      scrollHeight: { configurable: true, value: 200 },
      clientHeight: { configurable: true, value: 100 },
    });
    scrollArea.getBoundingClientRect = () => new DOMRect(0, 0, 100, 100);
    overview.getBoundingClientRect = () => new DOMRect(0, 120, 100, 20);
    const sidebarScroll = vi.fn();
    Object.defineProperty(scrollArea, "scrollBy", {
      configurable: true,
      value: sidebarScroll,
    });

    // fireEvent retained: scroll has no user-event equivalent and is the external event observed by the scroll-spy.
    fireEvent.scroll(mainContent);
    await waitFor(() => expect(overview).toHaveAttribute("aria-current", "location"));
    await waitFor(() => expect(sidebarScroll).toHaveBeenCalledWith({ top: 48, behavior }));

    overviewHeading.getBoundingClientRect = () => new DOMRect(0, 200, 100, 20);
    await user.click(overview);
    expect(mainScroll).toHaveBeenCalledWith({ top: 104, behavior });
  });
});

describe("MobileTocPanel", () => {
  function renderMobileToc(toc: TableOfContents = []) {
    const result = render(
      <main id="main-content">
        <h2 id="setup">Setup</h2>
        <h3 id="details">Details</h3>
        <h2 id="result">Result</h2>
        <MobileToc toc={toc} />
      </main>,
    );
    // jsdom does not implement Element.scrollTo; the scroll itself is the
    // active-heading hook's contract, not this panel's.
    Object.defineProperty(document.getElementById("main-content"), "scrollTo", {
      configurable: true,
      value: vi.fn(),
    });
    return result;
  }

  it("keeps the heading list collapsed until the reader opens the disclosure", async () => {
    renderMobileToc([{ title: "Setup", url: "#setup", depth: 2 }]);

    const nav = await screen.findByRole("navigation", { name: "On this page" });
    expect(nav).not.toBeVisible();
    expect(screen.getByText("On this page")).toBeVisible();
  });

  it("discloses every rendered heading, including runtime ones the compile-time TOC misses", async () => {
    const user = userEvent.setup();
    renderMobileToc([{ title: "Setup", url: "#setup", depth: 2 }]);

    await user.click(await screen.findByText("On this page"));

    const nav = screen.getByRole("navigation", { name: "On this page" });
    expect(
      within(nav)
        .getAllByRole("link")
        .map((link) => link.getAttribute("href")),
    ).toEqual(["#setup", "#details", "#result"]);
    expect(within(nav).getByRole("list")).toBeInTheDocument();
  });

  it("collapses again once the reader picks a heading", async () => {
    const user = userEvent.setup();
    renderMobileToc();

    await user.click(await screen.findByText("On this page"));
    const nav = screen.getByRole("navigation", { name: "On this page" });
    await user.click(within(nav).getByRole("link", { name: "Details" }));

    expect(nav).not.toBeVisible();
  });

  it("renders nothing when the page has no headings", () => {
    render(
      <main id="main-content">
        <p>No headings here.</p>
        <MobileToc toc={[]} />
      </main>,
    );

    expect(screen.queryByText("On this page")).not.toBeInTheDocument();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});
