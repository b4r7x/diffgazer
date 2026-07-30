// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import type { TableOfContents } from "fumadocs-core/toc";
import { afterEach, describe, expect, it } from "vitest";
import { DocsPageHeader, DocsPageLayout } from "./page-layout";

const TOC: TableOfContents = [
  { depth: 2, url: "#install", title: "Install" },
  { depth: 2, url: "#usage", title: "Usage" },
];

function Article() {
  return (
    <>
      <h2 id="install">Install</h2>
      <h2 id="usage">Usage</h2>
    </>
  );
}

/** useDocsToc reports ready only once it finds `<main id="main-content">`. */
function renderInContentContainer(): void {
  const main = document.createElement("main");
  main.id = "main-content";
  document.body.append(main);

  render(
    <DocsPageLayout toc={TOC}>
      <Article />
    </DocsPageLayout>,
    { container: main },
  );
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("DocsPageLayout table of contents", () => {
  it("resolves the loading skeletons into real tables of contents", () => {
    renderInContentContainer();

    // The mobile disclosure and the desktop rail swap on the same ready flag.
    const tocs = screen.getAllByRole("navigation", { name: "On this page" });
    expect(tocs).toHaveLength(2);

    for (const toc of tocs) {
      expect(toc).not.toHaveAttribute("aria-hidden");
      // A skeleton carries no links, so an unresolved table of contents fails here.
      const hrefs = within(toc)
        .getAllByRole("link")
        .map((link) => link.getAttribute("href"));
      expect(hrefs).toEqual(["#install", "#usage"]);
    }
  });

  it("keeps the skeleton out of the accessibility tree until the content container exists", () => {
    render(
      <DocsPageLayout toc={TOC}>
        <Article />
      </DocsPageLayout>,
    );

    expect(screen.queryAllByRole("navigation", { name: "On this page" })).toEqual([]);
    expect(screen.queryAllByRole("link")).toEqual([]);
  });
});

describe("DocsPageHeader", () => {
  it("renders the lib/slug scope line above the title", () => {
    render(<DocsPageHeader title="Button" lib="ui" slug="button" />);

    const heading = screen.getByRole("heading", { level: 1, name: "Button" });
    const scope = screen.getByText("ui/button");

    // The address precedes the destination, so the reader meets the path first
    // and the title is the last line before the tags.
    expect(scope.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("keeps tag chips alongside the meta line", () => {
    render(<DocsPageHeader title="Button" lib="ui" slug="button" tags={["stable", "form"]} />);

    expect(screen.getByText("ui/button")).toBeInTheDocument();
    expect(screen.getByText("stable")).toBeInTheDocument();
    expect(screen.getByText("form")).toBeInTheDocument();
  });

  it("omits the meta line when the slug is missing", () => {
    render(<DocsPageHeader title="Overview" lib="ui" />);

    expect(screen.queryByText(/^ui\//)).not.toBeInTheDocument();
  });

  it("typesets code spans in the description instead of shipping raw backticks", () => {
    render(
      <DocsPageHeader
        title="Theme"
        description="The `@diffgazer/ui` two-layer system, built on `--base-*` tokens."
      />,
    );

    expect(screen.getByText(/two-layer system/)).not.toHaveTextContent("`");
    expect(screen.getByText("@diffgazer/ui").tagName).toBe("CODE");
    expect(screen.getByText("--base-*").tagName).toBe("CODE");
  });

  it("renders an unpaired backtick verbatim rather than dropping characters", () => {
    render(<DocsPageHeader title="Theme" description="A stray ` backtick stays put." />);

    expect(screen.getByText("A stray ` backtick stays put.")).toBeInTheDocument();
  });
});
